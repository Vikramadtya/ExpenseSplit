import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BalancesModule } from '../balances/balances.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ConsoleMailer } from './channels/console.mailer';
import { Mailer } from './channels/mailer';
import { NoopPushSender } from './channels/noop-push.sender';
import { PushSender } from './channels/push-sender';
import { ResendMailer } from './channels/resend.mailer';
import { WebPushSender } from './channels/web-push.sender';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NudgesService } from './nudges.service';

@Global()
@Module({
  imports: [DatabaseModule, UsersModule, BalancesModule, WorkspacesModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NudgesService,
    NotificationsRepository,
    {
      // Push is on only when VAPID keys are configured.
      provide: PushSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushSender => {
        const publicKey = config.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
        if (!publicKey || !privateKey) return new NoopPushSender();
        const subject = config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@expensesplit.app';
        return new WebPushSender({ publicKey, privateKey, subject });
      },
    },
    {
      // Email goes out only when an API key is configured; otherwise it is logged.
      provide: Mailer,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Mailer => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        const from = config.get<string>('MAIL_FROM');
        return apiKey && from ? new ResendMailer(apiKey, from) : new ConsoleMailer();
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
