import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';

@Injectable()
export class SettlementsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async create(
    workspaceId: string,
    data: { payerId: string; payeeId: string; amount: number; date: string },
  ): Promise<any> {
    throw new Error('Not implemented');
  }

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    throw new Error('Not implemented');
  }
}
