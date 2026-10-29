import { Inject, Injectable } from '@nestjs/common';
import { SQL, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import type { GroupBy } from './analytics-query.dto';

export interface AnalyticsFilter {
  workspaceIds: string[];
  userId: string;
  from?: Date;
  to?: Date;
  currency?: string;
  groupBy: GroupBy;
}

type Row = Record<string, unknown>;

/** Aggregates are computed in SQL, over indexed rows, and never include deleted expenses or transfers. */
@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async run(f: AnalyticsFilter) {
    if (f.workspaceIds.length === 0) return null;
    const ids = sql.join(
      f.workspaceIds.map((id) => sql`${id}`),
      sql`, `,
    );
    // e: expense table alias. Every query below scopes with this same predicate.
    const where: SQL = sql`e.workspace_id IN (${ids}) AND e.deleted_at IS NULL AND e.type = 'EXPENSE'
      ${f.currency ? sql`AND e.currency = ${f.currency}` : sql``}
      ${f.from ? sql`AND e.date >= ${f.from.toISOString()}` : sql``}
      ${f.to ? sql`AND e.date <= ${f.to.toISOString()}` : sql``}`;
    const unit = sql.raw(`'${f.groupBy}'`); // groupBy is validated to one of three literals

    const [totals, overTime, categories, tags, members, mine, settlements] = await Promise.all([
      this.db.execute(sql`
        SELECT e.currency,
               SUM(e.amount) AS total,
               COUNT(*)::int AS n,
               COALESCE(SUM(e.amount) FILTER (WHERE e.date >= date_trunc('day', now() AT TIME ZONE 'UTC')), 0) AS today,
               COALESCE(SUM(e.amount) FILTER (WHERE e.date >= date_trunc('month', now() AT TIME ZONE 'UTC')), 0) AS this_month,
               COALESCE(SUM(e.amount) FILTER (
                 WHERE e.date >= date_trunc('month', (now() AT TIME ZONE 'UTC') - interval '1 month')
                   AND e.date < date_trunc('month', now() AT TIME ZONE 'UTC')), 0) AS last_month
          FROM expenses e WHERE ${where} GROUP BY e.currency`),
      this.db.execute(sql`
        SELECT e.currency, date_trunc(${unit}, e.date)::date AS bucket, SUM(e.amount) AS total
          FROM expenses e WHERE ${where} GROUP BY e.currency, bucket ORDER BY bucket`),
      this.db.execute(sql`
        SELECT e.currency, e.category, COUNT(*)::int AS n, SUM(e.amount) AS total
          FROM expenses e WHERE ${where} GROUP BY e.currency, e.category ORDER BY total DESC`),
      this.db.execute(sql`
        SELECT currency, tag, SUM(amount) AS total FROM (
          SELECT e.currency, e.amount, unnest(e.tags) AS tag FROM expenses e WHERE ${where}
        ) t GROUP BY currency, tag ORDER BY total DESC LIMIT 50`),
      this.db.execute(sql`
        SELECT e.currency, u.id AS user_id, u.name, SUM(s.amount_owed) AS amount
          FROM expenses e
          JOIN expense_splits s ON s.expense_id = e.id
          JOIN users u ON u.id = s.user_id
         WHERE ${where} GROUP BY e.currency, u.id, u.name ORDER BY amount DESC`),
      this.db.execute(sql`
        SELECT e.currency, SUM(s.amount_owed) AS owed, SUM(s.amount_paid) AS paid
          FROM expenses e JOIN expense_splits s ON s.expense_id = e.id
         WHERE ${where} AND s.user_id = ${f.userId} GROUP BY e.currency`),
      this.db.execute(sql`
        SELECT st.currency,
               COALESCE(SUM(st.amount) FILTER (WHERE st.payee_id = ${f.userId}), 0) AS received,
               COALESCE(SUM(st.amount) FILTER (WHERE st.payer_id = ${f.userId}), 0) AS paid
          FROM settlements st
         WHERE st.workspace_id IN (${ids})
           ${f.currency ? sql`AND st.currency = ${f.currency}` : sql``}
           ${f.from ? sql`AND st.date >= ${f.from.toISOString()}` : sql``}
           ${f.to ? sql`AND st.date <= ${f.to.toISOString()}` : sql``}
         GROUP BY st.currency`),
    ]);

    return { totals, overTime, categories, tags, members, mine, settlements } as Record<
      string,
      Row[]
    >;
  }

  /** Tags used in a workspace, most used first (for autocomplete). */
  async tagUsage(workspaceId: string) {
    const rows = await this.db.execute(sql`
      SELECT tag, COUNT(*)::int AS count FROM (
        SELECT unnest(tags) AS tag FROM expenses WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
      ) t GROUP BY tag ORDER BY count DESC, tag LIMIT 100`);
    return rows.map((r) => ({ tag: r.tag as string, count: r.count as number }));
  }

  async workspaceIdsOf(userId: string): Promise<string[]> {
    const rows = await this.db.execute(
      sql`SELECT workspace_id FROM workspace_members WHERE user_id = ${userId}`,
    );
    return rows.map((r) => r.workspace_id as string);
  }
}
