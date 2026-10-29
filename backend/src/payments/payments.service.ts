import { Inject, Injectable } from '@nestjs/common';
import { Money } from '../common/money/money';
import { UsersService } from '../users/users.service';
import { PAYMENT_LINK_BUILDERS, PaymentLink, PaymentLinkBuilder } from './payment-link.builder';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly users: UsersService,
    @Inject(PAYMENT_LINK_BUILDERS) private readonly builders: PaymentLinkBuilder[],
  ) {}

  /**
   * Links the payer can tap to pay `payeeId`. Money never passes through this app: it only
   * opens the payer's own payment app, so the settlement is recorded after they confirm.
   */
  async linksFor(
    requesterId: string,
    payeeId: string,
    amount: number,
    currency: string,
    note: string,
  ) {
    const payee = await this.users.findVisibleTo(requesterId, payeeId);
    const money = Money.fromMajor(amount, currency.toUpperCase());
    const links = this.builders
      .map((b) => b.build(payee, money, note))
      .filter((l): l is PaymentLink => l !== null);
    return { payee: { id: payee.id, name: payee.name }, links };
  }
}
