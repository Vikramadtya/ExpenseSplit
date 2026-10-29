import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { invites } from '../database/schema';

@Injectable()
export class InvitesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(data: {
    workspaceId: string;
    createdById: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    await this.db.insert(invites).values(data);
  }

  async findActiveByHash(tokenHash: string) {
    const [invite] = await this.db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.tokenHash, tokenHash),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return invite ?? null;
  }

  async revokeAll(workspaceId: string) {
    await this.db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.workspaceId, workspaceId), isNull(invites.revokedAt)));
  }
}
