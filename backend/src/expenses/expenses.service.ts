import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  IExpensesRepositoryToken,
  IWorkspacesRepositoryToken,
} from '../common/interfaces/repository.interfaces';
import type {
  ExpensePatch,
  IExpensesRepository,
  IWorkspacesRepository,
  NewSplit,
  Role,
} from '../common/interfaces/repository.interfaces';
import { Money } from '../common/money/money';
import { SplitStrategyRegistry } from './strategies/split-strategy.registry';
import type { SplitInput, SplitType } from './strategies/split.strategy';
import { buildSplitRows } from './split-builder';
import { EventBus } from '../common/events/event-bus';
import { NotificationsService } from '../notifications/notifications.service';

export interface ExpenseListQuery {
  q?: string;
  tags?: string;
  currency?: string;
  category?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

interface SplitPlan {
  amount: number;
  currency: string;
  splitType: SplitType;
  payers: { userId: string; amount: number }[];
  splitInput: SplitInput;
}

const encodeCursor = (e: { date: Date; id: string }) =>
  Buffer.from(JSON.stringify({ d: e.date.toISOString(), i: e.id })).toString('base64url');

const decodeCursor = (cursor: string) => {
  try {
    const { d, i } = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    const date = new Date(d);
    if (Number.isNaN(date.getTime()) || typeof i !== 'string') throw new Error();
    return { date, id: i };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
};

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(IExpensesRepositoryToken)
    private readonly expensesRepository: IExpensesRepository,
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspacesRepository: IWorkspacesRepository,
    private readonly strategies: SplitStrategyRegistry,
    private readonly events: EventBus,
    private readonly notifications: NotificationsService,
  ) {}

  /** Throws if this expense could not be saved (bad split, non-members...), without saving it. */
  async validate(workspaceId: string, data: CreateExpenseDto): Promise<void> {
    await this.planSplits(workspaceId, {
      amount: data.amount,
      currency: data.currency,
      splitType: data.splitType,
      payers: data.payers,
      splitInput: this.extractSplitInput(data),
    });
  }

  async create(
    workspaceId: string,
    createdById: string,
    data: CreateExpenseDto,
    origin?: { ruleId: string; occurrenceAt: Date },
  ) {
    const splitInput = this.extractSplitInput(data);
    const rows = await this.planSplits(workspaceId, {
      amount: data.amount,
      currency: data.currency,
      splitType: data.splitType,
      payers: data.payers,
      splitInput,
    });

    const created = await this.expensesRepository.createWithSplits(
      {
        workspaceId,
        createdById,
        description: data.description,
        amount: Money.fromMajor(data.amount, data.currency).toDecimal(),
        currency: data.currency,
        category: data.category,
        date: new Date(data.date),
        splitType: data.splitType,
        type: data.type,
        tags: data.tags ?? [],
        recurringInterval: data.recurringInterval,
        splitInput,
        recurringRuleId: origin?.ruleId,
        occurrenceAt: origin?.occurrenceAt,
      },
      rows,
    );
    this.emit('expense.created', created, createdById);
    this.notifications.notifyLater(
      created.splits.map((s: { userId: string }) => s.userId),
      {
        kind: 'expense.added',
        workspaceId,
        actorId: createdById,
        payload: {
          expenseId: created.id,
          description: created.description,
          amount: Number(created.amount),
          currency: created.currency,
        },
      },
    );
    return created;
  }

  async list(workspaceId: string, query: ExpenseListQuery) {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const rows = await this.expensesRepository.findPage(workspaceId, {
      q: query.q?.trim() || undefined,
      tags: query.tags?.split(',').filter(Boolean),
      currency: query.currency?.toUpperCase(),
      category: query.category,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      after: query.cursor ? decodeCursor(query.cursor) : undefined,
      limit: limit + 1,
    });

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;
    return { items, nextCursor };
  }

  async findOne(workspaceId: string, expenseId: string) {
    const expense = await this.expensesRepository.findById(expenseId);
    if (!expense || expense.workspaceId !== workspaceId) {
      throw new NotFoundException('Expense not found in this workspace');
    }
    return expense;
  }

  async update(workspaceId: string, expenseId: string, data: UpdateExpenseDto) {
    const existing = await this.findOne(workspaceId, expenseId);
    const { expectedVersion } = data;
    if (expectedVersion !== undefined && expectedVersion !== existing.version) {
      throw new ConflictException('Expense was modified by someone else');
    }

    const patch: ExpensePatch = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.date !== undefined) patch.date = new Date(data.date);
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.category !== undefined) patch.category = data.category;

    const affectsSplits = [
      data.amount,
      data.currency,
      data.splitType,
      data.payers,
      data.paidBy,
      data.participants,
      data.exactAmounts,
      data.percentages,
      data.shares,
      data.items,
      data.tax,
      data.tip,
    ].some((v) => v !== undefined);

    let splits: NewSplit[] | null = null;
    if (affectsSplits) {
      const plan = this.mergePlan(existing, data);
      splits = await this.planSplits(workspaceId, plan);
      patch.amount = Money.fromMajor(plan.amount, plan.currency).toDecimal();
      patch.currency = plan.currency;
      patch.splitType = plan.splitType;
      patch.splitInput = plan.splitInput;
    }

    const updated = await this.expensesRepository.updateWithSplits(
      expenseId,
      patch,
      splits,
      expectedVersion,
    );
    if (!updated) throw new ConflictException('Expense was modified by someone else');
    return updated;
  }

  async remove(workspaceId: string, expenseId: string) {
    await this.findOne(workspaceId, expenseId);
    await this.expensesRepository.softDelete(expenseId);
    return true;
  }

  /** For routes addressed by expense id: resolves the expense and checks the caller is a member. */
  async findOneWithUserAccess(expenseId: string, userId: string) {
    return (await this.resolve(expenseId, userId)).expense;
  }

  async updateWithUserAccess(expenseId: string, userId: string, data: UpdateExpenseDto) {
    const { expense, role } = await this.resolve(expenseId, userId);
    this.assertCanModify(expense, userId, role);
    const updated = await this.update(expense.workspaceId, expenseId, data);
    this.emit('expense.updated', expense, userId);
    return updated;
  }

  async removeWithUserAccess(expenseId: string, userId: string) {
    const { expense, role } = await this.resolve(expenseId, userId);
    this.assertCanModify(expense, userId, role);
    const removed = await this.remove(expense.workspaceId, expenseId);
    this.emit('expense.deleted', expense, userId);
    return removed;
  }

  /** Undo for delete. */
  async restoreWithUserAccess(expenseId: string, userId: string) {
    const { expense, role } = await this.resolve(expenseId, userId, true);
    this.assertCanModify(expense, userId, role);
    await this.expensesRepository.restore(expenseId);
    this.emit('expense.restored', expense, userId);
    return this.findOne(expense.workspaceId, expenseId);
  }

  private emit(type: string, expense: { id: string; workspaceId: string }, actorId: string) {
    this.events.publish({ workspaceId: expense.workspaceId, type, entityId: expense.id, actorId });
  }

  private async resolve(expenseId: string, userId: string, includeDeleted = false) {
    const expense = await this.expensesRepository.findById(expenseId, includeDeleted);
    const role = expense
      ? await this.workspacesRepository.findMemberRole(expense.workspaceId, userId)
      : null;
    // Same response as a missing expense so ids can't be probed across workspaces.
    if (!expense || !role) throw new NotFoundException('Expense not found');
    return { expense, role };
  }

  /** Members can add expenses; changing one is for whoever created it, or an admin. */
  private assertCanModify(expense: { createdById: string }, userId: string, role: Role) {
    if (role !== 'ADMIN' && expense.createdById !== userId) {
      throw new ForbiddenException('Only the creator or a workspace admin can change this expense');
    }
  }

  private extractSplitInput(data: SplitInput): SplitInput {
    const { participants, exactAmounts, percentages, shares, items, tax, tip } = data;
    return { participants, exactAmounts, percentages, shares, items, tax, tip };
  }

  /** Overlays the requested changes on what is already stored. */
  private mergePlan(existing: any, data: UpdateExpenseDto): SplitPlan {
    const splitType: SplitType = data.splitType ?? existing.splitType;
    const touchesSplitInput = [
      data.participants,
      data.exactAmounts,
      data.percentages,
      data.shares,
    ].some((v) => v !== undefined);

    let splitInput: SplitInput;
    if (touchesSplitInput) {
      splitInput = this.extractSplitInput(data);
    } else if (existing.splitInput && splitType === existing.splitType) {
      splitInput = existing.splitInput;
    } else {
      // Older rows have no stored input; fall back to everyone who owed something.
      splitInput = {
        participants: existing.splits
          .filter((s: any) => Number(s.amountOwed) > 0)
          .map((s: any) => s.userId),
      };
    }

    const amount = data.amount ?? Number(existing.amount);
    const currency = data.currency ?? existing.currency;
    return {
      amount,
      currency,
      splitType,
      payers:
        data.payers ??
        (data.paidBy
          ? [{ userId: data.paidBy, amount }]
          : this.rescalePayers(existing.splits, amount, currency)),
      splitInput,
    };
  }

  /** Keeps the same people paying, in the same proportions, when only the total changes. */
  private rescalePayers(splits: any[], amount: number, currency: string) {
    const payers = splits.filter((s) => Number(s.amountPaid) > 0);
    const parts = Money.fromMajor(amount, currency).allocate(
      payers.map((s) => Number(s.amountPaid)),
    );
    return payers.map((s, i) => ({ userId: s.userId as string, amount: parts[i].toMajor() }));
  }

  private async planSplits(workspaceId: string, plan: SplitPlan): Promise<NewSplit[]> {
    const total = Money.fromMajor(plan.amount, plan.currency);
    const input: SplitInput = {
      ...plan.splitInput,
      // Equal splits default to "split between the people who paid".
      participants: plan.splitInput.participants?.length
        ? plan.splitInput.participants
        : plan.payers.map((p) => p.userId),
    };

    const owed = this.strategies.get(plan.splitType).allocate(total, input);
    const rows = buildSplitRows(total, owed, plan.payers);

    if (
      !(await this.workspacesRepository.allAreMembers(
        workspaceId,
        rows.map((r) => r.userId),
      ))
    ) {
      throw new BadRequestException('Everyone in an expense must be a member of the workspace');
    }

    return rows.map((r) => ({
      userId: r.userId,
      amountOwed: r.owed.toDecimal(),
      amountPaid: r.paid.toDecimal(),
    }));
  }
}
