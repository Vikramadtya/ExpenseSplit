import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { eq } from 'drizzle-orm';
import { expenses, expenseSplits } from '../database/schema';

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    return this.db.query.expenses.findMany({
      where: eq(expenses.workspaceId, workspaceId),
      with: {
        createdBy: true,
        splits: {
          with: { user: true },
        },
      },
      orderBy: (expenses, { desc }) => [desc(expenses.createdAt)],
    });
  }

  async findById(id: string): Promise<any> {
    const expense = await this.db.query.expenses.findFirst({
      where: eq(expenses.id, id),
      with: {
        createdBy: true,
        splits: {
          with: { user: true },
        },
      },
    });
    return expense || null;
  }

  async create(data: any): Promise<any> {
    const [expense] = await this.db.insert(expenses).values(data).returning();
    return expense;
  }

  async createSplit(data: any): Promise<any> {
    const [split] = await this.db.insert(expenseSplits).values(data).returning();
    return split;
  }

  async update(id: string, data: any): Promise<any> {
    const [updated] = await this.db
      .update(expenses)
      .set(data)
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(expenses).where(eq(expenses.id, id));
  }

  async getSplits(expenseId: string): Promise<any[]> {
    return this.db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  }
}
