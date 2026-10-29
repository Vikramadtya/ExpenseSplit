import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository, Role } from '../common/interfaces/repository.interfaces';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { RecurringInterval, occurrenceAt } from './occurrence';
import { RecurringRepository, RecurringRule } from './recurring.repository';

/** Most occurrences created in one run for a rule that fell behind (e.g. server was down). */
const MAX_CATCH_UP = 12;
const BATCH_SIZE = 50;

const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e?.cause?.code ?? e?.code) === '23505';
};

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly rules: RecurringRepository,
    private readonly expenses: ExpensesService,
    private readonly notifications: NotificationsService,
    @Inject(IWorkspacesRepositoryToken) private readonly workspaces: IWorkspacesRepository,
  ) {}

  list(workspaceId: string) {
    return this.rules.listByWorkspace(workspaceId);
  }

  /** Saves the rule and creates the first occurrence straight away if it is already due. */
  async create(workspaceId: string, userId: string, dto: CreateRecurringDto) {
    const { startDate, interval, ...template } = dto;
    // Reject an impossible split now instead of failing silently on the first run.
    await this.expenses.validate(workspaceId, {
      ...template,
      date: startDate,
      recurringInterval: 'NONE',
    });

    const startAt = new Date(startDate);
    const rule = await this.rules.create({
      workspaceId,
      createdById: userId,
      template,
      interval,
      startAt,
      nextRunAt: startAt,
    });
    await this.runRule(rule, new Date());
    return (await this.rules.findById(rule.id)) ?? rule;
  }

  /** Called on a timer. Safe to run on several instances at once. */
  async runDue(now = new Date()): Promise<number> {
    const due = await this.rules.findDue(now, BATCH_SIZE);
    let created = 0;
    for (const rule of due) {
      try {
        created += await this.runRule(rule, now);
      } catch (err) {
        this.logger.error(`Rule ${rule.id} failed: ${err}`);
      }
    }
    return created;
  }

  /** Skips the next occurrence without creating an expense. */
  async skipNext(workspaceId: string, ruleId: string) {
    const rule = await this.find(workspaceId, ruleId);
    const runCount = rule.runCount + 1;
    await this.rules.advance(
      rule.id,
      rule.nextRunAt,
      runCount,
      occurrenceAt(rule.startAt, rule.interval as RecurringInterval, runCount),
    );
    return this.rules.findById(rule.id);
  }

  async setActive(
    workspaceId: string,
    ruleId: string,
    active: boolean,
    userId: string,
    role: Role,
  ) {
    const rule = await this.find(workspaceId, ruleId);
    this.assertCanManage(rule, userId, role);
    if (!active) {
      await this.rules.setActive(rule.id, false);
    } else {
      // Resume from the next future occurrence: never back-fill the time it was paused.
      const interval = rule.interval as RecurringInterval;
      let n = rule.runCount;
      while (occurrenceAt(rule.startAt, interval, n) <= new Date()) n++;
      await this.rules.setActive(rule.id, true, {
        runCount: n,
        nextRunAt: occurrenceAt(rule.startAt, interval, n),
      });
    }
    return this.rules.findById(rule.id);
  }

  async remove(workspaceId: string, ruleId: string, userId: string, role: Role) {
    const rule = await this.find(workspaceId, ruleId);
    this.assertCanManage(rule, userId, role);
    await this.rules.delete(rule.id);
  }

  private async find(workspaceId: string, ruleId: string) {
    const rule = await this.rules.findById(ruleId);
    if (!rule || rule.workspaceId !== workspaceId)
      throw new NotFoundException('Recurring expense not found');
    return rule;
  }

  private assertCanManage(rule: RecurringRule, userId: string, role: Role) {
    if (role !== 'ADMIN' && rule.createdById !== userId) {
      throw new ForbiddenException('Only the creator or a workspace admin can change this');
    }
  }

  /** Creates every occurrence that is due for this rule. Returns how many were created. */
  private async runRule(rule: RecurringRule, now: Date): Promise<number> {
    const interval = rule.interval as RecurringInterval;
    const template = rule.template as Omit<CreateExpenseDto, 'date' | 'recurringInterval'>;
    let current = rule;
    let created = 0;

    while (current.active && current.nextRunAt <= now && created < MAX_CATCH_UP) {
      const occurrence = current.nextRunAt;
      try {
        if (!(await this.workspaces.findMemberRole(rule.workspaceId, rule.createdById))) {
          throw new Error('the person who set this up has left the workspace');
        }
        await this.expenses.create(
          rule.workspaceId,
          rule.createdById,
          { ...template, date: occurrence.toISOString(), recurringInterval: 'NONE' },
          { ruleId: rule.id, occurrenceAt: occurrence },
        );
        created++;
      } catch (err) {
        // Already created by a run that crashed before advancing: carry on.
        if (!isUniqueViolation(err)) return created + (await this.fail(rule, err));
      }

      const runCount = current.runCount + 1;
      const nextRunAt = occurrenceAt(rule.startAt, interval, runCount);
      if (!(await this.rules.advance(rule.id, occurrence, runCount, nextRunAt))) return created;
      current = { ...current, runCount, nextRunAt };
    }

    // Fell further behind than the catch-up cap: skip ahead rather than flood the group.
    if (current.active && current.nextRunAt <= now) {
      let n = current.runCount;
      while (occurrenceAt(rule.startAt, interval, n) <= now) n++;
      await this.rules.advance(
        rule.id,
        current.nextRunAt,
        n,
        occurrenceAt(rule.startAt, interval, n),
      );
    }
    return created;
  }

  private async fail(rule: RecurringRule, err: unknown): Promise<number> {
    const reason = err instanceof Error ? err.message : String(err);
    await this.rules.pause(rule.id, reason);
    await this.notifications.notify([rule.createdById], {
      kind: 'recurring.failed',
      workspaceId: rule.workspaceId,
      payload: { description: (rule.template as { description?: string }).description, reason },
    });
    return 0;
  }
}
