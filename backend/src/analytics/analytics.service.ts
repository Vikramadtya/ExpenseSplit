import { Injectable } from '@nestjs/common';
import { Currency } from '../common/money/currency';
import { AnalyticsQueryDto } from './analytics-query.dto';
import { AnalyticsRepository } from './analytics.repository';

/** Rounds an aggregate to the currency's own decimals (0 for yen, 3 for dinars). */
const money = (v: unknown, currency: string) => Currency.of(currency).round(Number(v ?? 0));
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

  tags(workspaceId: string, q?: string, limit?: number) {
    return this.repository.tagUsage(workspaceId, q, limit);
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
      const total = money(t.total, currency);
      const before = forCurrency(data.previous, currency)[0];
      const previousSpend = before ? money(before.total, currency) : null;
      const thisMonth = money(t.this_month, currency);
      const lastMonth = money(t.last_month, currency);

      return {
        currency,
        totalSpend: money(t.total, currency),
        expenseCount: t.n as number,
        // Your own share of the spending, what you actually paid out, and payments between friends.
        trueSpending: money(mine?.owed, currency),
        cashOut: money(mine?.paid, currency),
        received: money(settled?.received, currency),
        paid: money(settled?.paid, currency),
        todaySpend: money(t.today, currency),
        thisMonthSpend: thisMonth,
        lastMonthSpend: lastMonth,
        monthOverMonthChange:
          lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : null,
        averageExpense: t.n ? money(Number(t.total) / (t.n as number), currency) : 0,
        // The same-length window just before the chosen period; null for "all time".
        previousPeriodSpend: q.from ? (previousSpend ?? 0) : null,
        changeVsPrevious:
          previousSpend && previousSpend > 0
            ? Math.round(((total - previousSpend) / previousSpend) * 1000) / 10
            : null,
        biggestExpenses: forCurrency(data.biggest, currency)
          .slice(0, 5)
          .map((e) => ({
            id: e.id as string,
            description: e.description as string,
            category: e.category as string,
            date: iso(e.date),
            amount: money(e.amount, currency),
          })),
        yourShareByCategory: forCurrency(data.myCategories, currency).map((c) => ({
          category: c.category as string,
          total: money(c.total, currency),
        })),
        spendByMember: forCurrency(data.members, currency).map((m) => ({
          userId: m.user_id as string,
          name: m.name as string,
          amount: money(m.amount, currency),
        })),
        spendOverTime: forCurrency(data.overTime, currency).map((r) => ({
          date: iso(r.bucket),
          amount: money(r.total, currency),
        })),
        // Kept under its old name for existing clients: `description` is the category.
        topCategories: forCurrency(data.categories, currency).map((c) => ({
          description: c.category as string,
          count: c.n as number,
          total: money(c.total, currency),
        })),
        tagsAnalysis: forCurrency(data.tags, currency).map((r) => ({
          tag: r.tag as string,
          total: money(r.total, currency),
        })),
      };
    });
    return { byCurrency };
  }
}
