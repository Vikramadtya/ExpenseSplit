import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { receipts } from '../database/schema';

export type ReceiptRow = typeof receipts.$inferSelect;

@Injectable()
export class ReceiptsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(data: typeof receipts.$inferInsert): Promise<ReceiptRow> {
    const [row] = await this.db.insert(receipts).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<ReceiptRow | null> {
    const [row] = await this.db.select().from(receipts).where(eq(receipts.id, id));
    return row ?? null;
  }

  async finish(id: string, patch: { status: 'DONE' | 'FAILED'; result?: unknown; error?: string }) {
    await this.db
      .update(receipts)
      .set({
        status: patch.status,
        result: patch.result ?? null,
        error: patch.error?.slice(0, 300) ?? null,
      })
      .where(eq(receipts.id, id));
  }
}
