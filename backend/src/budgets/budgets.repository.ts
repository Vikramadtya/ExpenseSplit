import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { budgets } from '../database/schema';

export type Budget = typeof budgets.$inferSelect;

@Injectable()
export class BudgetsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  list(workspaceId: string) {
    return this.db
      .select()
      .from(budgets)
      .where(eq(budgets.workspaceId, workspaceId))
      .orderBy(budgets.category);
  }

  findMatching(workspaceId: string, currency: string, categories: string[]) {
    return this.db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.workspaceId, workspaceId),
          eq(budgets.currency, currency),
          inArray(budgets.category, categories),
        ),
      );
  }

  async upsert(data: {
    workspaceId: string;
    category: string;
    currency: string;
    amount: string;
    createdById: string;
  }) {
    const [row] = await this.db
      .insert(budgets)
      .values(data)
      .onConflictDoUpdate({
        target: [budgets.workspaceId, budgets.category, budgets.currency],
        // A new limit starts fresh: the old limit's alerts no longer apply.
        set: { amount: data.amount, lastAlertPercent: 0, lastAlertMonth: null },
      })
      .returning();
    return row;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.workspaceId, workspaceId)))
      .returning({ id: budgets.id });
    return rows.length > 0;
  }

  /** What the workspace spent this month, in one currency (optionally one category). */
  async spentThisMonth(
    workspaceId: string,
    currency: string,
    categories: string[] | 'ALL',
  ): Promise<number> {
    const rows = await this.db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS spent FROM expenses
       WHERE workspace_id = ${workspaceId} AND currency = ${currency}
         AND deleted_at IS NULL AND type = 'EXPENSE'
         AND date >= date_trunc('month', now() AT TIME ZONE 'UTC') AND date < date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
         ${
           categories === 'ALL'
             ? sql``
             : sql`AND category IN (${sql.join(
                 categories.map((c) => sql`${c}`),
                 sql`, `,
               )})`
         }`);
    return Number(rows[0]?.spent ?? 0);
  }

  /**
   * Records that `threshold` has been announced for this month. Only one caller can win per
   * threshold, so concurrent expenses never send the same alert twice.
   */
  async claimAlert(id: string, threshold: number): Promise<boolean> {
    const rows = await this.db.execute(sql`
      UPDATE budgets SET last_alert_percent = ${threshold},
                         last_alert_month = date_trunc('month', now() AT TIME ZONE 'UTC')::date
       WHERE id = ${id}
         AND (last_alert_month IS DISTINCT FROM date_trunc('month', now() AT TIME ZONE 'UTC')::date
              OR last_alert_percent < ${threshold})
      RETURNING id`);
    return rows.length > 0;
  }
}
