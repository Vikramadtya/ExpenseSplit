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

  async create(data: { email: string; name: string; avatarUrl?: string }): Promise<any> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async findAll(): Promise<any[]> {
    return this.db.select().from(users);
  }
}
