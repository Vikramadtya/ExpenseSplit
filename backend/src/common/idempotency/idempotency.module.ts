import { Global, Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyRepository } from './idempotency.repository';

@Global()
@Module({
  providers: [IdempotencyRepository, IdempotencyInterceptor],
  exports: [IdempotencyRepository, IdempotencyInterceptor],
})
export class IdempotencyModule {}
