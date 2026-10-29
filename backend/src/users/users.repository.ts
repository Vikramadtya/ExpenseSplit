import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { users } from '../database/schema';
import type { IUsersRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findById(id: string): Promise<any> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async findByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(users).where(inArray(users.id, ids));
  }

  async findByEmail(email: string): Promise<any> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async create(data: {
    email: string;
    name: string;
    avatarUrl?: string;
    isRegistered?: boolean;
  }): Promise<any> {
    const [user] = await this.db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
        isRegistered: data.isRegistered ?? true,
      })
      .returning();
    return user;
  }

  async update(id: string, data: Parameters<IUsersRepository['update']>[1]): Promise<any> {
    const [user] = await this.db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async sharesWorkspace(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return true;
    const rows = await this.db.execute(sql`
      SELECT 1 FROM workspace_members a
      JOIN workspace_members b ON a.workspace_id = b.workspace_id
      WHERE a.user_id = ${userA} AND b.user_id = ${userB}
      LIMIT 1
    `);
    return rows.length > 0;
  }
}
