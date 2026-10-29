import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { refreshTokens } from '../database/schema';

export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class RefreshTokensRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.insert(refreshTokens).values(data);
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  /** Atomically marks a token used. False means someone else already used it. */
  async consume(id: string): Promise<boolean> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length > 0;
  }

  async revokeFamily(familyId: string) {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}
