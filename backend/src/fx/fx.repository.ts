import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { fxRates } from '../database/schema';

@Injectable()
export class FxRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  findByBase(base: string) {
    return this.db.select().from(fxRates).where(eq(fxRates.base, base));
  }

  async replace(base: string, date: string, rates: Record<string, number>) {
    const rows = Object.entries(rates).map(([quote, rate]) => ({
      base,
      quote,
      rate: String(rate),
      rateDate: date,
      fetchedAt: new Date(),
    }));
    if (rows.length === 0) return;
    await this.db
      .insert(fxRates)
      .values(rows)
      .onConflictDoUpdate({
        target: [fxRates.base, fxRates.quote],
        set: {
          rate: sql`excluded.rate`,
          rateDate: sql`excluded.rate_date`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }
}
