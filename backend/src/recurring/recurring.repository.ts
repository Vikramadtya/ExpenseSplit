import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lte } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { recurringRules } from '../database/schema';

export type RecurringRule = typeof recurringRules.$inferSelect;

@Injectable()
export class RecurringRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(data: typeof recurringRules.$inferInsert): Promise<RecurringRule> {
    const [rule] = await this.db.insert(recurringRules).values(data).returning();
    return rule;
  }

  async findById(id: string): Promise<RecurringRule | null> {
    const [rule] = await this.db.select().from(recurringRules).where(eq(recurringRules.id, id));
    return rule ?? null;
  }

  listByWorkspace(workspaceId: string) {
    return this.db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.workspaceId, workspaceId))
      .orderBy(asc(recurringRules.nextRunAt));
  }

  findDue(now: Date, limit: number) {
    return this.db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.active, true), lte(recurringRules.nextRunAt, now)))
      .orderBy(asc(recurringRules.nextRunAt))
      .limit(limit);
  }

  /**
   * Moves the rule forward only if nobody else already did, so two server instances can
   * never both advance (and double-bill) the same occurrence.
   */
  async advance(id: string, expectedNextRunAt: Date, runCount: number, nextRunAt: Date) {
    const rows = await this.db
      .update(recurringRules)
      .set({ runCount, nextRunAt, lastError: null })
      .where(and(eq(recurringRules.id, id), eq(recurringRules.nextRunAt, expectedNextRunAt)))
      .returning({ id: recurringRules.id });
    return rows.length > 0;
  }

  async setActive(
    id: string,
    active: boolean,
    patch: { nextRunAt?: Date; runCount?: number } = {},
  ) {
    await this.db
      .update(recurringRules)
      .set({ active, lastError: null, ...patch })
      .where(eq(recurringRules.id, id));
  }

  async pause(id: string, reason: string) {
    await this.db
      .update(recurringRules)
      .set({ active: false, lastError: reason.slice(0, 300) })
      .where(eq(recurringRules.id, id));
  }

  async delete(id: string) {
    await this.db.delete(recurringRules).where(eq(recurringRules.id, id));
  }
}
