import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';

@Injectable()
export class BalancesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async getNetBalances(workspaceId: string): Promise<Array<{ userId: string; net: number }>> {
    throw new Error('Not implemented — add your Drizzle aggregation query here');
  }

  async getExpenseDebts(
    workspaceId: string,
  ): Promise<Array<{ debtor: string; creditor: string; amount: number }>> {
    throw new Error('Not implemented — add your Drizzle query here');
  }
}
