import { Inject, Injectable } from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.module';
import { idempotencyKeys } from '../../database/schema';

const KEEP_FOR_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  /** True if this call won the right to run the request. */
  async claim(userId: string, key: string, path: string): Promise<boolean> {
    const rows = await this.db
      .insert(idempotencyKeys)
      .values({ userId, key, path })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });
    return rows.length > 0;
  }

  async find(userId: string, key: string) {
    const [row] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
      .limit(1);
    return row ?? null;
  }

  async complete(userId: string, key: string, response: unknown) {
    await this.db
      .update(idempotencyKeys)
      .set({ response: response ?? {} })
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
    // Housekeeping: occasionally drop keys older than a day.
    if (Math.random() < 0.02) {
      await this.db
        .delete(idempotencyKeys)
        .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - KEEP_FOR_MS)));
    }
  }

  async release(userId: string, key: string) {
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
  }
}
