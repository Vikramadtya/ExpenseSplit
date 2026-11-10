import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { budgets, categories, expenses } from '../database/schema';

export type Category = typeof categories.$inferSelect;

@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  list(workspaceId: string): Promise<Category[]> {
    return this.db.select().from(categories).where(eq(categories.workspaceId, workspaceId));
  }

  /** Expense counts per category name, for showing usage next to each category. */
  async usage(workspaceId: string): Promise<Map<string, number>> {
    const rows = await this.db.execute(sql`
      SELECT category, COUNT(*)::int AS n FROM expenses
       WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL GROUP BY category`);
    return new Map(rows.map((r) => [r.category as string, r.n as number]));
  }

  async findById(workspaceId: string, id: string): Promise<Category | undefined> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.workspaceId, workspaceId)));
    return row;
  }

  /** Inserts the defaults once; concurrent first requests are harmless (unique name). */
  async seed(workspaceId: string, rows: { name: string; icon: string }[]) {
    await this.db
      .insert(categories)
      .values(rows.map((r) => ({ ...r, workspaceId })))
      .onConflictDoNothing();
  }

  async insert(row: typeof categories.$inferInsert): Promise<Category> {
    const [created] = await this.db.insert(categories).values(row).returning();
    return created;
  }

  /** Renaming carries the expenses and budgets that use the old name along with it. */
  async update(
    workspaceId: string,
    existing: Category,
    patch: { name?: string; icon?: string; parentId?: string | null },
  ): Promise<Category> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(categories)
        .set(patch)
        .where(eq(categories.id, existing.id))
        .returning();
      if (patch.name !== undefined && patch.name !== existing.name) {
        await tx
          .update(expenses)
          .set({ category: patch.name })
          .where(and(eq(expenses.workspaceId, workspaceId), eq(expenses.category, existing.name)));
        await tx
          .update(budgets)
          .set({ category: patch.name })
          .where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.category, existing.name)));
      }
      return row;
    });
  }

  /** Children move up to the top level; expenses go to `moveTo`; its budgets are dropped. */
  async remove(workspaceId: string, existing: Category, moveTo: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({ category: moveTo })
        .where(and(eq(expenses.workspaceId, workspaceId), eq(expenses.category, existing.name)));
      await tx
        .delete(budgets)
        .where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.category, existing.name)));
      await tx
        .update(categories)
        .set({ parentId: null })
        .where(eq(categories.parentId, existing.id));
      await tx.delete(categories).where(eq(categories.id, existing.id));
    });
  }
}
