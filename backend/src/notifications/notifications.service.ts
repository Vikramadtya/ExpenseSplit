import { Inject, Injectable, Logger } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { EventBus } from '../common/events/event-bus';
import { UsersService } from '../users/users.service';
import { Mailer } from './channels/mailer';
import { PushSender } from './channels/push-sender';
import { EMAIL_KINDS, NotificationKind, describe } from './notification-message';
import { NotificationsRepository } from './notifications.repository';

export interface NotifyInput {
  kind: NotificationKind;
  workspaceId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly users: UsersService,
    private readonly push: PushSender,
    private readonly mailer: Mailer,
    private readonly events: EventBus,
    @Inject(IWorkspacesRepositoryToken) private readonly workspaces: IWorkspacesRepository,
  ) {}

  /** Fire-and-forget: the caller's request never waits for (or fails because of) notifications. */
  notifyLater(recipientIds: string[], input: NotifyInput): void {
    void this.notify(recipientIds, input).catch((err) => this.logger.warn(`Notify failed: ${err}`));
  }

  /**
   * Records a notification for each recipient (except the actor and anyone who muted this
   * kind), then pushes/emails best-effort. Delivery failures never fail the caller.
   */
  async notify(recipientIds: string[], input: NotifyInput): Promise<void> {
    const ids = [...new Set(recipientIds)].filter((id) => id !== input.actorId);
    if (ids.length === 0) return;

    const payload = await this.enrich(input);
    const recipients = (await this.users.findByIds(ids)).filter(
      (u) => !(u.mutedNotificationKinds as string[]).includes(input.kind),
    );
    const rows = await this.repository.createMany(
      recipients.map((u) => ({
        userId: u.id,
        workspaceId: input.workspaceId ?? null,
        actorId: input.actorId ?? null,
        kind: input.kind,
        payload,
      })),
    );
    if (rows.length === 0) return;

    if (input.workspaceId) {
      this.events.publish({ workspaceId: input.workspaceId, type: 'notification.created' });
    }

    const message = describe(input.kind, payload);
    await Promise.allSettled(
      recipients.map(async (user) => {
        await this.deliverPush(user.id, message, input.workspaceId);
        if (EMAIL_KINDS.has(input.kind)) {
          await this.mailer.send({ to: user.email, subject: message.title, text: message.body });
        }
      }),
    ).then((results) =>
      results.forEach(
        (r) => r.status === 'rejected' && this.logger.warn(`Delivery failed: ${r.reason}`),
      ),
    );
  }

  /** Adds who did it and where, so triggers only need to pass what is specific to them. */
  private async enrich(input: NotifyInput): Promise<Record<string, unknown>> {
    const payload = { ...input.payload };
    const [actor, workspace] = await Promise.all([
      input.actorId && payload.byName === undefined ? this.users.findById(input.actorId) : null,
      input.workspaceId && payload.workspaceName === undefined
        ? this.workspaces.findById(input.workspaceId)
        : null,
    ]);
    if (actor) payload.byName = actor.name;
    if (workspace) payload.workspaceName = workspace.name;
    return payload;
  }

  private async deliverPush(
    userId: string,
    message: { title: string; body: string },
    workspaceId?: string,
  ) {
    if (!this.push.enabled) return;
    const url = workspaceId ? `/dashboard?workspaceId=${workspaceId}` : '/';
    for (const sub of await this.repository.subscriptionsFor(userId)) {
      const alive = await this.push.send(sub, { ...message, url }).catch((err) => {
        this.logger.warn(`Push failed: ${err}`);
        return true;
      });
      if (!alive) await this.repository.deleteSubscription(sub.endpoint);
    }
  }

  async list(userId: string, limit = 30) {
    const [items, unreadCount] = await Promise.all([
      this.repository.list(userId, Math.min(Math.max(limit, 1), 100)),
      this.repository.unreadCount(userId),
    ]);
    return {
      unreadCount,
      items: items.map((n) => ({
        ...n,
        message: describe(n.kind, n.payload as Record<string, unknown>),
      })),
    };
  }

  markRead(userId: string, id: string) {
    return this.repository.markRead(userId, id);
  }

  markAllRead(userId: string) {
    return this.repository.markAllRead(userId);
  }

  pushPublicKey() {
    return { publicKey: this.push.publicKey() };
  }

  subscribe(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
    return this.repository.saveSubscription({ userId, ...sub });
  }

  unsubscribe(userId: string, endpoint: string) {
    return this.repository.deleteSubscription(endpoint, userId);
  }
}
