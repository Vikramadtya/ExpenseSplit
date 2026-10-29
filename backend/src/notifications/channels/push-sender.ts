export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Delivers a browser push message. Resolves false when the subscription is gone for good. */
export abstract class PushSender {
  abstract readonly enabled: boolean;
  abstract publicKey(): string | null;
  abstract send(target: PushTarget, payload: PushPayload): Promise<boolean>;
}
