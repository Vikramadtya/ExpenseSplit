export interface WorkspaceEvent {
  workspaceId: string;
  /** e.g. `expense.created`, `settlement.created`, `member.joined` */
  type: string;
  entityId?: string;
  actorId?: string;
}

/**
 * Publishes things that happened in a workspace. Events carry ids only: subscribers re-read
 * data through the normal authorized APIs, so an event can never leak content.
 * The in-memory implementation is single-instance; a Redis pub/sub one can replace it.
 */
export abstract class EventBus {
  abstract publish(event: WorkspaceEvent): void;
  abstract subscribe(workspaceId: string, handler: (event: WorkspaceEvent) => void): () => void;
}
