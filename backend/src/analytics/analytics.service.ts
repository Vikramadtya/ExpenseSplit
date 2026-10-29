import { Injectable } from '@nestjs/common';
import { AnalyticsQueryDto } from './analytics-query.dto';
import { AnalyticsRepository } from './analytics.repository';

const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const iso = (v: unknown) =>
  (v instanceof Date ? v : new Date(String(v))).toISOString().split('T')[0];

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  /** One workspace you belong to (membership is checked by the guard). */
  forWorkspace(workspaceId: string, userId: string, query: AnalyticsQueryDto) {
    return this.build([workspaceId], userId, query);
  }

  /** Everything across every workspace you belong to. */
  async forUser(userId: string, query: AnalyticsQueryDto) {
    return this.build(await this.repository.workspaceIdsOf(userId), userId, query);
  }

  tags(workspaceId: string) {
    return this.repository.tagUsage(workspaceId);
  }

  private async build(workspaceIds: string[], userId: string, q: AnalyticsQueryDto) {
    const data = await this.repository.run({
      workspaceIds,
      userId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      currency: q.currency?.toUpperCase(),
      groupBy: q.groupBy,
    });
    if (!data) return { byCurrency: [] };

    const forCurrency = (rows: Record<string, unknown>[], currency: string) =>
      rows.filter((r) => r.currency === currency);

    const byCurrency = data.totals.map((t) => {
      const currency = t.currency as string;
      const mine = forCurrency(data.mine, currency)[0];
      const settled = forCurrency(data.settlements, currency)[0];
      const thisMonth = num(t.this_month);
      const lastMonth = num(t.last_month);

      return {
        currency,
        totalSpend: num(t.total),
        expenseCount: t.n as number,
        // Your own share of the spending, what you actually paid out, and payments between friends.
        trueSpending: num(mine?.owed),
        cashOut: num(mine?.paid),
        received: num(settled?.received),
        paid: num(settled?.paid),
        todaySpend: num(t.today),
        thisMonthSpend: thisMonth,
        lastMonthSpend: lastMonth,
        monthOverMonthChange:
          lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : null,
        spendByMember: forCurrency(data.members, currency).map((m) => ({
          userId: m.user_id as string,
          name: m.name as string,
          amount: num(m.amount),
        })),
        spendOverTime: forCurrency(data.overTime, currency).map((r) => ({
          date: iso(r.bucket),
          amount: num(r.total),
        })),
        // Kept under its old name for existing clients: `description` is the category.
        topCategories: forCurrency(data.categories, currency).map((c) => ({
          description: c.category as string,
          count: c.n as number,
          total: num(c.total),
        })),
        tagsAnalysis: forCurrency(data.tags, currency).map((r) => ({
          tag: r.tag as string,
          total: num(r.total),
        })),
      };
    });
    return { byCurrency };
  }
}
