import { Injectable } from '@nestjs/common';
import { PushPayload, PushSender, PushTarget } from './push-sender';

/** Used when no VAPID keys are configured: push is simply off. */
@Injectable()
export class NoopPushSender extends PushSender {
  readonly enabled = false;

  publicKey() {
    return null;
  }

  async send(_target: PushTarget, _payload: PushPayload): Promise<boolean> {
    return true;
  }
}
