import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './../database/database.module';
import type { DrizzleDb } from '../database/database.module';

export const IExpensesRepositoryToken = 'IExpensesRepositoryToken';

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findByWorkspace(workspaceId: string): Promise<any[]> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async findByGroup(groupId: string): Promise<any[]> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async findById(id: string): Promise<any> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async create(data: any): Promise<any> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async update(id: string, data: any): Promise<any> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented — add your Drizzle query here');
  }

  async getSplits(expenseId: string): Promise<any[]> {
    throw new Error('Not implemented — add your Drizzle query here');
  }
}
