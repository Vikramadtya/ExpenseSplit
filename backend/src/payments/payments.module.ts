import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PayPalLinkBuilder, UpiLinkBuilder, VenmoLinkBuilder } from './builders';
import { PAYMENT_LINK_BUILDERS } from './payment-link.builder';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [UsersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    UpiLinkBuilder,
    PayPalLinkBuilder,
    VenmoLinkBuilder,
    {
      provide: PAYMENT_LINK_BUILDERS,
      inject: [UpiLinkBuilder, PayPalLinkBuilder, VenmoLinkBuilder],
      useFactory: (...builders: unknown[]) => builders,
    },
  ],
})
export class PaymentsModule {}
