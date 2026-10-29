import { Inject, Injectable } from '@nestjs/common';
import { eq, or, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import {
  expenseComments,
  expenseSplits,
  expenses,
  invites,
  notifications,
  pushSubscriptions,
  refreshTokens,
  settlements,
  users,
  workspaceMembers,
  workspaces,
} from '../database/schema';

@Injectable()
export class AccountRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  /** Everything the app holds about one person (their own records only). */
  async collect(userId: string) {
    const [profile, memberships, created, splits, payments, comments] = await Promise.all([
      this.db.query.users.findFirst({ where: eq(users.id, userId) }),
      this.db
        .select({
          workspaceId: workspaces.id,
          name: workspaces.name,
          type: workspaces.type,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId)),
      this.db.select().from(expenses).where(eq(expenses.createdById, userId)),
      this.db.select().from(expenseSplits).where(eq(expenseSplits.userId, userId)),
      this.db
        .select()
        .from(settlements)
        .where(or(eq(settlements.payerId, userId), eq(settlements.payeeId, userId))),
      this.db.select().from(expenseComments).where(eq(expenseComments.userId, userId)),
    ]);
    return { profile, memberships, created, splits, payments, comments };
  }

  /**
   * Removes the person but keeps the ledger intact: expenses and payments they took part in
   * still reference the row, which becomes an anonymous placeholder. Personal data is wiped.
   */
  async anonymize(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await tx.delete(notifications).where(eq(notifications.userId, userId));
      await tx.delete(expenseComments).where(eq(expenseComments.userId, userId));
      await tx.delete(invites).where(eq(invites.createdById, userId));
      await tx
        .update(users)
        .set({
          name: 'Deleted user',
          email: sql`'deleted-' || ${users.id} || '@deleted.invalid'`,
          avatarUrl: null,
          upiVpa: null,
          paypalMe: null,
          venmoHandle: null,
          mutedNotificationKinds: [],
          isRegistered: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });
  }
}
