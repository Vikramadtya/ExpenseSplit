import { Inject, Injectable } from '@nestjs/common';
import { and, arrayOverlaps, eq, gte, ilike, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { expenses, expenseSplits } from '../database/schema';
import type {
  ExpenseFilter,
  ExpensePatch,
  IExpensesRepository,
  NewExpense,
  NewSplit,
} from '../common/interfaces/repository.interfaces';

const WITH_RELATIONS = { createdBy: true, splits: { with: { user: true } } } as const;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class ExpensesRepository implements IExpensesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findPage(workspaceId: string, filter: ExpenseFilter): Promise<any[]> {
    const { q, tags, currency, from, to, after, limit } = filter;
    return this.db.query.expenses.findMany({
      where: and(
        eq(expenses.workspaceId, workspaceId),
        isNull(expenses.deletedAt),
        q ? ilike(expenses.description, `%${escapeLike(q)}%`) : undefined,
        tags?.length ? arrayOverlaps(expenses.tags, tags) : undefined,
        currency ? eq(expenses.currency, currency) : undefined,
        from ? gte(expenses.date, from) : undefined,
        to ? lte(expenses.date, to) : undefined,
        // Keyset pagination: matches the (workspace_id, date DESC, id DESC) index.
        after
          ? or(
              lt(expenses.date, after.date),
              and(eq(expenses.date, after.date), lt(expenses.id, after.id)),
            )
          : undefined,
      ),
      with: WITH_RELATIONS,
      orderBy: sql`${expenses.date} DESC NULLS LAST, ${expenses.id} DESC NULLS LAST`,
      limit,
    });
  }

  async findById(id: string, includeDeleted = false): Promise<any> {
    const expense = await this.db.query.expenses.findFirst({
      where: and(eq(expenses.id, id), includeDeleted ? undefined : isNull(expenses.deletedAt)),
      with: WITH_RELATIONS,
    });
    return expense ?? null;
  }

  async createWithSplits(expense: NewExpense, splits: NewSplit[]): Promise<any> {
    const id = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(expenses).values(expense).returning({ id: expenses.id });
      await tx
        .insert(expenseSplits)
        .values(
          splits.map((s) => ({ ...s, workspaceId: expense.workspaceId, expenseId: created.id })),
        );
      return created.id;
    });
    return this.findById(id);
  }

  async updateWithSplits(
    id: string,
    patch: ExpensePatch,
    splits: NewSplit[] | null,
    expectedVersion?: number,
  ): Promise<any> {
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(expenses)
        .set({ ...patch, version: sql`${expenses.version} + 1` })
        .where(
          and(
            eq(expenses.id, id),
            expectedVersion === undefined ? undefined : eq(expenses.version, expectedVersion),
          ),
        )
        .returning({ workspaceId: expenses.workspaceId });
      if (!row) return false;

      if (splits) {
        await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
        await tx
          .insert(expenseSplits)
          .values(splits.map((s) => ({ ...s, workspaceId: row.workspaceId, expenseId: id })));
      }
      return true;
    });
    return updated ? this.findById(id) : null;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.update(expenses).set({ deletedAt: new Date() }).where(eq(expenses.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db.update(expenses).set({ deletedAt: null }).where(eq(expenses.id, id));
  }
}
