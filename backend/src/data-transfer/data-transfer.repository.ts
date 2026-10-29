import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { expenses, settlements } from '../database/schema';

const MAX_EXPORT_ROWS = 20_000;
const day = (d: Date) => d.toISOString().split('T')[0];

/** Same key for an imported row and a stored one, so a re-import skips what is already there. */
export const expenseKey = (
  date: Date | string,
  description: string,
  amount: number | string,
  currency: string,
) =>
  `E|${typeof date === 'string' ? date : day(date)}|${description.trim().toLowerCase()}|${Number(amount).toFixed(2)}|${currency}`;
export const paymentKey = (
  date: Date | string,
  payerId: string,
  payeeId: string,
  amount: number | string,
  currency: string,
) =>
  `S|${typeof date === 'string' ? date : day(date)}|${payerId}|${payeeId}|${Number(amount).toFixed(2)}|${currency}`;

@Injectable()
export class DataTransferRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async exportRows(workspaceId: string, from?: Date, to?: Date) {
    const [rows, payments] = await Promise.all([
      this.db.query.expenses.findMany({
        where: and(
          eq(expenses.workspaceId, workspaceId),
          eq(expenses.type, 'EXPENSE'),
          isNull(expenses.deletedAt),
          from ? gte(expenses.date, from) : undefined,
          to ? lte(expenses.date, to) : undefined,
        ),
        with: { splits: true },
        orderBy: [asc(expenses.date)],
        limit: MAX_EXPORT_ROWS,
      }),
      this.db.query.settlements.findMany({
        where: and(
          eq(settlements.workspaceId, workspaceId),
          from ? gte(settlements.date, from) : undefined,
          to ? lte(settlements.date, to) : undefined,
        ),
        orderBy: [asc(settlements.date)],
        limit: MAX_EXPORT_ROWS,
      }),
    ]);
    return { expenses: rows, settlements: payments };
  }

  async existingKeys(workspaceId: string): Promise<Set<string>> {
    const [rows, payments] = await Promise.all([
      this.db
        .select({
          date: expenses.date,
          description: expenses.description,
          amount: expenses.amount,
          currency: expenses.currency,
        })
        .from(expenses)
        .where(and(eq(expenses.workspaceId, workspaceId), isNull(expenses.deletedAt))),
      this.db.select().from(settlements).where(eq(settlements.workspaceId, workspaceId)),
    ]);
    return new Set([
      ...rows.map((r) => expenseKey(r.date, r.description, r.amount, r.currency)),
      ...payments.map((p) => paymentKey(p.date, p.payerId, p.payeeId, p.amount, p.currency)),
    ]);
  }
}
