import { Injectable, Logger } from '@nestjs/common';
import { Email, Mailer } from './mailer';

/** Default when no email provider is configured: logs instead of sending. */
@Injectable()
export class ConsoleMailer extends Mailer {
  private readonly logger = new Logger('Mailer');

  async send(email: Email): Promise<void> {
    this.logger.log(
      `(not sent: no email provider configured) to=${email.to} subject="${email.subject}"`,
    );
  }
}
