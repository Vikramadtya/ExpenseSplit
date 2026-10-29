import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { notifications, pushSubscriptions } from '../database/schema';

export interface NewNotification {
  userId: string;
  workspaceId?: string | null;
  actorId?: string | null;
  kind: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async createMany(rows: NewNotification[]) {
    if (rows.length === 0) return [];
    return this.db.insert(notifications).values(rows).returning();
  }

  list(userId: string, limit: number) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row.count;
  }

  async markRead(userId: string, id: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  /** Has `actorId` already sent this kind to `userId` in this workspace since `since`? */
  async existsSince(
    userId: string,
    actorId: string,
    workspaceId: string,
    kind: string,
    since: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.actorId, actorId),
          eq(notifications.workspaceId, workspaceId),
          eq(notifications.kind, kind),
          gt(notifications.createdAt, since),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  subscriptionsFor(userId: string) {
    return this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async saveSubscription(data: { userId: string; endpoint: string; p256dh: string; auth: string }) {
    await this.db
      .insert(pushSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: data.userId, p256dh: data.p256dh, auth: data.auth },
      });
  }

  async deleteSubscription(endpoint: string, userId?: string) {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          userId ? eq(pushSubscriptions.userId, userId) : undefined,
        ),
      );
  }
}
