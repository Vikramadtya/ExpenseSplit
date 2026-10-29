import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { expenseComments } from '../database/schema';

@Injectable()
export class CommentsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  findByExpense(expenseId: string) {
    return this.db.query.expenseComments.findMany({
      where: eq(expenseComments.expenseId, expenseId),
      with: { user: { columns: { id: true, name: true, avatarUrl: true } } },
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });
  }

  async findById(id: string) {
    const [comment] = await this.db
      .select()
      .from(expenseComments)
      .where(eq(expenseComments.id, id))
      .limit(1);
    return comment ?? null;
  }

  async create(data: { workspaceId: string; expenseId: string; userId: string; body: string }) {
    const [comment] = await this.db.insert(expenseComments).values(data).returning();
    return comment;
  }

  async delete(id: string) {
    await this.db.delete(expenseComments).where(eq(expenseComments.id, id));
  }
}
