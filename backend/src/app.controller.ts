import { Controller, Get, Inject } from '@nestjs/common';
import { DRIZZLE_CLIENT } from './database/database.module';
import type { DrizzleDb } from './database/database.module';
import { sql } from 'drizzle-orm';

@Controller()
export class AppController {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  @Get()
  getHello(): string {
    return 'ExpenseSplit API is running!';
  }

  @Get('health')
  async getHealth() {
    try {
      // Execute a simple query to ensure DB connection is happening
      const result = await this.db.execute(sql`SELECT 1`);
      return { status: 'ok', db: 'connected', result };
    } catch (e) {
      return { status: 'error', db: 'disconnected', error: e.message };
    }
  }
}
