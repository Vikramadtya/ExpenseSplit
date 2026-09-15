import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { settlements } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class SettlementsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(
    workspaceId: string,
    data: { payerId: string; payeeId: string; amount: number; date: string },
  ): Promise<any> {
    const [settlement] = await this.db
      .insert(settlements)
      .values({
        workspaceId,
        payerId: data.payerId,
        payeeId: data.payeeId,
        amount: data.amount.toString(),
        date: new Date(data.date),
      })
      .returning();
    return settlement;
  }

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    return this.db.query.settlements.findMany({
      where: eq(settlements.workspaceId, workspaceId),
      with: {
        payer: true,
        payee: true,
      },
      orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
    });
  }
}
