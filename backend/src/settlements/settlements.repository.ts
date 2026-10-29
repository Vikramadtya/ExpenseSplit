import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { settlements } from '../database/schema';
import type { ISettlementsRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class SettlementsRepository implements ISettlementsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(
    workspaceId: string,
    data: { payerId: string; payeeId: string; amount: string; currency: string; date: Date },
  ): Promise<any> {
    const [settlement] = await this.db
      .insert(settlements)
      .values({ workspaceId, ...data })
      .returning();
    return settlement;
  }

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    return this.db.query.settlements.findMany({
      where: eq(settlements.workspaceId, workspaceId),
      with: { payer: true, payee: true },
      orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
    });
  }
}
