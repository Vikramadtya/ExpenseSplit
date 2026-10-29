import { Money } from '../common/money/money';

export interface PayeeHandles {
  name: string;
  upiVpa?: string | null;
  paypalMe?: string | null;
  venmoHandle?: string | null;
}

export interface PaymentLink {
  method: 'UPI' | 'PAYPAL' | 'VENMO';
  label: string;
  url: string;
}

/** Builds a deep link into one payment app. Returns null when it can't pay this person/currency. */
export interface PaymentLinkBuilder {
  build(payee: PayeeHandles, amount: Money, note: string): PaymentLink | null;
}

export const PAYMENT_LINK_BUILDERS = Symbol('PAYMENT_LINK_BUILDERS');
