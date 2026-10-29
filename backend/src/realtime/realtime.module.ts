import { Module } from '@nestjs/common';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { RealtimeController } from './realtime.controller';

@Module({
  controllers: [RealtimeController],
  providers: [
    makeGaugeProvider({ name: 'sse_connections', help: 'Open live-sync (SSE) connections' }),
  ],
})
export class RealtimeModule {}
