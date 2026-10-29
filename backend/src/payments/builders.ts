import { Injectable } from '@nestjs/common';
import { Money } from '../common/money/money';
import { PayeeHandles, PaymentLink, PaymentLinkBuilder } from './payment-link.builder';

const enc = encodeURIComponent;

@Injectable()
export class UpiLinkBuilder implements PaymentLinkBuilder {
  build(payee: PayeeHandles, amount: Money, note: string): PaymentLink | null {
    if (!payee.upiVpa || amount.currency !== 'INR') return null;
    const url = `upi://pay?pa=${enc(payee.upiVpa)}&pn=${enc(payee.name)}&am=${amount.toDecimal()}&cu=INR&tn=${enc(note)}`;
    return { method: 'UPI', label: 'Pay with UPI', url };
  }
}

@Injectable()
export class PayPalLinkBuilder implements PaymentLinkBuilder {
  build(payee: PayeeHandles, amount: Money): PaymentLink | null {
    if (!payee.paypalMe) return null;
    const url = `https://paypal.me/${enc(payee.paypalMe)}/${amount.toDecimal()}${amount.currency}`;
    return { method: 'PAYPAL', label: 'Pay with PayPal', url };
  }
}

@Injectable()
export class VenmoLinkBuilder implements PaymentLinkBuilder {
  build(payee: PayeeHandles, amount: Money, note: string): PaymentLink | null {
    if (!payee.venmoHandle || amount.currency !== 'USD') return null;
    const url = `https://venmo.com/${enc(payee.venmoHandle)}?txn=pay&amount=${amount.toDecimal()}&note=${enc(note)}`;
    return { method: 'VENMO', label: 'Pay with Venmo', url };
  }
}
