import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { sql } from 'drizzle-orm';
import { workspaces } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async getWorkspaceAnalytics(workspaceId: string) {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!workspace) return null;

    // We'll calculate simple aggregates for now via direct SQL queries
    const totalSpendResult = await this.db.execute(sql`
      SELECT SUM(amount) as total, COUNT(id) as count
      FROM expenses
      WHERE workspace_id = ${workspaceId}
    `);
    const totalSpend = Number(totalSpendResult[0]?.total || 0);
    const expenseCount = Number(totalSpendResult[0]?.count || 0);

    const spendOverTime = await this.db.execute(sql`
      SELECT date_trunc('day', date) as day, SUM(amount) as total
      FROM expenses
      WHERE workspace_id = ${workspaceId}
      GROUP BY day
      ORDER BY day ASC
    `);

    // Flatten tags array into individual rows to group by them
    const tagsAnalysis = await this.db.execute(sql`
      SELECT tag, SUM(amount) as total
      FROM (
        SELECT amount, unnest(tags) as tag
        FROM expenses
        WHERE workspace_id = ${workspaceId}
      ) t
      GROUP BY tag
      ORDER BY total DESC
    `);

    // True spending is amount_owed in expense_splits
    const spendByMember = await this.db.execute(sql`
      SELECT u.id as "userId", u.name, SUM(s.amount_owed) as amount
      FROM expense_splits s
      JOIN users u ON s.user_id = u.id
      WHERE s.workspace_id = ${workspaceId}
      GROUP BY u.id, u.name
      ORDER BY amount DESC
    `);

    return {
      byCurrency: [
        {
          currency: workspace.defaultCurrency,
          totalSpend,
          expenseCount,
          trueSpending: totalSpend, // Simplified
          cashOut: totalSpend, // Simplified
          received: 0, // Simplified
          paid: 0, // Simplified
          todaySpend: 0, // Simplified
          thisMonthSpend: totalSpend, // Simplified
          spendByMember: spendByMember.map((r) => ({
            userId: r.userId,
            name: r.name,
            amount: Number(r.amount),
          })),
          spendOverTime: spendOverTime.map((r) => ({
            date: new Date(r.day as string).toISOString().split('T')[0],
            amount: Number(r.total),
          })),
          topCategories: [], // Deprecated without categories table
          tagsAnalysis: tagsAnalysis.map((r) => ({
            tag: r.tag,
            total: Number(r.total),
          })),
        },
      ],
    };
  }
}
