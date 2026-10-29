import { Injectable } from '@nestjs/common';
import webpush from 'web-push';
import { PushPayload, PushSender, PushTarget } from './push-sender';

@Injectable()
export class WebPushSender extends PushSender {
  readonly enabled = true;

  constructor(private readonly vapid: { publicKey: string; privateKey: string; subject: string }) {
    super();
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  }

  publicKey() {
    return this.vapid.publicKey;
  }

  async send(target: PushTarget, payload: PushPayload): Promise<boolean> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 },
      );
      return true;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return false; // the browser revoked it
      throw err;
    }
  }
}
