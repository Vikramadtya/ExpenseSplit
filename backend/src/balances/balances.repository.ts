import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { sql } from 'drizzle-orm';

@Injectable()
export class BalancesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async getExpenseDebts(
    workspaceId: string,
  ): Promise<Array<{ debtor: string; creditor: string; amount: number }>> {
    // For each expense_split row: debtor = split.userId, creditor = expense.createdById
    // Net owed = amount_owed - amount_paid
    const result = await this.db.execute(sql`
      SELECT
        s.user_id AS debtor,
        e.created_by_id AS creditor,
        SUM(s.amount_owed - s.amount_paid) AS amount
      FROM expense_splits s
      JOIN expenses e ON s.expense_id = e.id
      WHERE s.workspace_id = ${workspaceId}
        AND s.user_id != e.created_by_id
      GROUP BY s.user_id, e.created_by_id
      HAVING SUM(s.amount_owed - s.amount_paid) > 0
    `);

    return result.map((row) => ({
      debtor: row.debtor as string,
      creditor: row.creditor as string,
      amount: Number(row.amount),
    }));
  }

  async getNetBalances(workspaceId: string): Promise<Array<{ userId: string; net: number }>> {
    // A net balance for a user is:
    // (Amount paid across all splits) - (Amount owed across all splits) + (Settlements received) - (Settlements paid)
    // Actually, simpler:
    // Expenses net: SUM(amount_paid) - SUM(amount_owed) for the user in expense_splits
    // Settlements net: SUM(amount) where payee = user - SUM(amount) where payer = user

    const result = await this.db.execute(sql`
      WITH expense_net AS (
        SELECT user_id, SUM(amount_paid - amount_owed) AS net
        FROM expense_splits
        WHERE workspace_id = ${workspaceId}
        GROUP BY user_id
      ),
      settlement_received AS (
        SELECT payee_id AS user_id, SUM(amount) AS net
        FROM settlements
        WHERE workspace_id = ${workspaceId}
        GROUP BY payee_id
      ),
      settlement_paid AS (
        SELECT payer_id AS user_id, SUM(amount) AS net
        FROM settlements
        WHERE workspace_id = ${workspaceId}
        GROUP BY payer_id
      )
      SELECT 
        COALESCE(e.user_id, sr.user_id, sp.user_id) AS "userId",
        COALESCE(e.net, 0) + COALESCE(sr.net, 0) - COALESCE(sp.net, 0) AS net
      FROM expense_net e
      FULL OUTER JOIN settlement_received sr ON e.user_id = sr.user_id
      FULL OUTER JOIN settlement_paid sp ON e.user_id = sp.user_id
    `);

    return result.map((row) => ({
      userId: row.userId as string,
      net: Number(row.net),
    }));
  }
}
