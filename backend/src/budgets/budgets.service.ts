import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { Money } from '../common/money/money';
import { CategoriesService } from '../categories/categories.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Budget, BudgetsRepository } from './budgets.repository';

/** Percentages at which the group is told, highest first. */
const ALERT_THRESHOLDS = [100, 80];

export const alertThreshold = (percent: number): number =>
  ALERT_THRESHOLDS.find((t) => percent >= t) ?? 0;

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly repository: BudgetsRepository,
    private readonly notifications: NotificationsService,
    private readonly categories: CategoriesService,
    @Inject(IWorkspacesRepositoryToken) private readonly workspaces: IWorkspacesRepository,
  ) {}

  async list(workspaceId: string) {
    const budgets = await this.repository.list(workspaceId);
    return Promise.all(budgets.map((b) => this.withUsage(b)));
  }

  async set(
    workspaceId: string,
    userId: string,
    data: { category: string; currency: string; amount: number },
  ) {
    const category =
      data.category === 'ALL' ? 'ALL' : await this.categories.find(workspaceId, data.category);
    if (!category) throw new BadRequestException(`Unknown category "${data.category}"`);
    const row = await this.repository.upsert({
      workspaceId,
      createdById: userId,
      category,
      currency: data.currency,
      amount: Money.fromMajor(data.amount, data.currency).toDecimal(),
    });
    return this.withUsage(row);
  }

  async remove(workspaceId: string, id: string) {
    if (!(await this.repository.delete(workspaceId, id)))
      throw new NotFoundException('Budget not found');
  }

  /** Fire-and-forget after an expense is saved: warns the group at 80% and 100% of a limit. */
  checkLater(expense: { workspaceId: string; currency: string; category: string }): void {
    void this.check(expense).catch((err) => this.logger.warn(`Budget check failed: ${err}`));
  }

  private async check(expense: { workspaceId: string; currency: string; category: string }) {
    const matching = await this.repository.findMatching(expense.workspaceId, expense.currency, [
      'ALL',
      ...(await this.categories.lineage(expense.workspaceId, expense.category)),
    ]);
    for (const budget of matching) {
      const { spent, percent } = await this.usage(budget);
      const threshold = alertThreshold(percent);
      if (threshold === 0 || !(await this.repository.claimAlert(budget.id, threshold))) continue;

      const members = await this.workspaces.getMembers(budget.workspaceId);
      await this.notifications.notify(
        members.map((m: { id: string }) => m.id),
        {
          kind: 'budget.alert',
          workspaceId: budget.workspaceId,
          payload: {
            percent: threshold,
            label: budget.category === 'ALL' ? 'Spending' : budget.category,
            spent,
            limit: Number(budget.amount),
            currency: budget.currency,
          },
        },
      );
    }
  }

  private async usage(budget: Budget) {
    // A budget on a parent category also counts what its sub-categories spent.
    const scope =
      budget.category === 'ALL'
        ? 'ALL'
        : await this.categories.branch(budget.workspaceId, budget.category);
    const spent = await this.repository.spentThisMonth(budget.workspaceId, budget.currency, scope);
    const limit = Number(budget.amount);
    return { spent, percent: limit > 0 ? Math.floor((spent / limit) * 100) : 0 };
  }

  private async withUsage(budget: Budget) {
    const { spent, percent } = await this.usage(budget);
    return {
      id: budget.id,
      category: budget.category,
      currency: budget.currency,
      amount: Number(budget.amount),
      spent,
      percent,
    };
  }
}
