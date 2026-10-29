import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { Money } from '../common/money/money';
import type {
  IBalancesRepository,
  MemberNetBalance,
  NetBalance,
  SettlementRecord,
  SplitRecord,
} from '../common/interfaces/repository.interfaces';

/**
 * Net position per member and currency:
 *   expenses:    amount_paid - amount_owed
 *   settlements: +amount for the payer (their debt shrank), -amount for the payee.
 */
const netByMember = (scope: ReturnType<typeof sql>) => sql`
  SELECT workspace_id, user_id, currency, SUM(net) AS net FROM (
    SELECT s.workspace_id, s.user_id, e.currency, s.amount_paid - s.amount_owed AS net
      FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
     WHERE s.workspace_id ${scope}
    UNION ALL
    SELECT workspace_id, payer_id, currency, amount FROM settlements WHERE workspace_id ${scope}
    UNION ALL
    SELECT workspace_id, payee_id, currency, -amount FROM settlements WHERE workspace_id ${scope}
  ) t
  GROUP BY workspace_id, user_id, currency
  HAVING SUM(net) <> 0
`;

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async getNetBalances(workspaceId: string): Promise<NetBalance[]> {
    const rows = await this.db.execute(netByMember(sql`= ${workspaceId}`));
    return rows.map((r) => this.toNet(r));
  }

  async getNetBalancesForMember(userId: string): Promise<MemberNetBalance[]> {
    const mine = sql`IN (SELECT workspace_id FROM workspace_members WHERE user_id = ${userId})`;
    const rows = await this.db.execute(netByMember(mine));
    return rows.map((r) => ({ ...this.toNet(r), workspaceId: r.workspace_id as string }));
  }

  async getSplitRecords(workspaceId: string, currency: string): Promise<SplitRecord[]> {
    const rows = await this.db.execute(sql`
      SELECT s.expense_id, s.user_id, s.amount_owed, s.amount_paid
        FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
       WHERE s.workspace_id = ${workspaceId} AND e.currency = ${currency}
    `);
    return rows.map((r) => ({
      expenseId: r.expense_id as string,
      userId: r.user_id as string,
      owed: Money.fromMajor(r.amount_owed as string, currency),
      paid: Money.fromMajor(r.amount_paid as string, currency),
    }));
  }

  async getSettlementRecords(workspaceId: string, currency: string): Promise<SettlementRecord[]> {
    const rows = await this.db.execute(sql`
      SELECT payer_id, payee_id, amount FROM settlements
       WHERE workspace_id = ${workspaceId} AND currency = ${currency}
    `);
    return rows.map((r) => ({
      payerId: r.payer_id as string,
      payeeId: r.payee_id as string,
      amount: Money.fromMajor(r.amount as string, currency),
    }));
  }

  private toNet(row: Record<string, unknown>): NetBalance {
    const currency = row.currency as string;
    return {
      userId: row.user_id as string,
      currency,
      net: Money.fromMajor(row.net as string, currency),
    };
  }
}
