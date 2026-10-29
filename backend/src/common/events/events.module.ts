import { Global, Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { InMemoryEventBus } from './in-memory-event-bus';

@Global()
@Module({
  providers: [{ provide: EventBus, useClass: InMemoryEventBus }],
  exports: [EventBus],
})
export class EventsModule {}
