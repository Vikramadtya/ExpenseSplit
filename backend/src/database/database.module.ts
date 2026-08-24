import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_CLIENT = Symbol('DRIZZLE_CLIENT');

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const drizzleProvider = {
  provide: DRIZZLE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const client = postgres(url);
    return drizzle(client, { schema });
  },
};

@Global()
@Module({
  providers: [drizzleProvider],
  exports: [DRIZZLE_CLIENT],
})
export class DatabaseModule {}
