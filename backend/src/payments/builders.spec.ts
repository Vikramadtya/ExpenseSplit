import { Money } from '../common/money/money';
import { PayPalLinkBuilder, UpiLinkBuilder, VenmoLinkBuilder } from './builders';

const payee = { name: 'Ana Ray', upiVpa: 'ana@okbank', paypalMe: 'anaray', venmoHandle: 'ana-ray' };

describe('payment link builders', () => {
  it('builds a UPI link for rupee amounts only', () => {
    const b = new UpiLinkBuilder();
    expect(b.build(payee, Money.fromMajor(1250.5, 'INR'), 'Dinner & drinks')?.url).toBe(
      'upi://pay?pa=ana%40okbank&pn=Ana%20Ray&am=1250.50&cu=INR&tn=Dinner%20%26%20drinks',
    );
    expect(b.build(payee, Money.fromMajor(10, 'USD'), 'x')).toBeNull();
    expect(b.build({ name: 'Ana' }, Money.fromMajor(10, 'INR'), 'x')).toBeNull();
  });

  it('builds a PayPal link in any currency', () => {
    expect(new PayPalLinkBuilder().build(payee, Money.fromMajor(20, 'EUR'), '')?.url).toBe(
      'https://paypal.me/anaray/20.00EUR',
    );
    expect(
      new PayPalLinkBuilder().build({ name: 'Ana' }, Money.fromMajor(20, 'EUR'), ''),
    ).toBeNull();
  });

  it('builds a Venmo link for dollar amounts only', () => {
    const b = new VenmoLinkBuilder();
    expect(b.build(payee, Money.fromMajor(7.5, 'USD'), 'Lunch')?.url).toBe(
      'https://venmo.com/ana-ray?txn=pay&amount=7.50&note=Lunch',
    );
    expect(b.build(payee, Money.fromMajor(7.5, 'EUR'), 'Lunch')).toBeNull();
  });

  it('escapes handles so they cannot inject URL parts', () => {
    const url = new PayPalLinkBuilder().build(
      { name: 'x', paypalMe: 'a/b?c=d' },
      Money.fromMajor(1, 'USD'),
      '',
    )?.url;
    expect(url).toBe('https://paypal.me/a%2Fb%3Fc%3Dd/1.00USD');
  });
});
