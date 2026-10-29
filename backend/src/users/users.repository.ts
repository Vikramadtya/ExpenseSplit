import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findById(id: string): Promise<any> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || null;
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

  async update(
    id: string,
    data: Partial<{ name: string; avatarUrl: string; isRegistered: boolean }>,
  ): Promise<any> {
    const [user] = await this.db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async findAll(): Promise<any[]> {
    return this.db.select().from(users);
  }
}
