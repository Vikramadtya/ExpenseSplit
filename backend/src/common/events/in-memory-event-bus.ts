import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { EventBus, WorkspaceEvent } from './event-bus';

@Injectable()
export class InMemoryEventBus extends EventBus {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  publish(event: WorkspaceEvent): void {
    this.emitter.emit(event.workspaceId, event);
  }

  subscribe(workspaceId: string, handler: (event: WorkspaceEvent) => void): () => void {
    this.emitter.on(workspaceId, handler);
    return () => this.emitter.off(workspaceId, handler);
  }
}
