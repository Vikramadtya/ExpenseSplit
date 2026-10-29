import fc from 'fast-check';
import { Money } from './money';

describe('Money', () => {
  it('parses decimals without float drift', () => {
    expect(Money.fromMajor(1.005, 'USD').minor).toBe(101);
    expect(Money.fromMajor('0.1', 'USD').add(Money.fromMajor('0.2', 'USD')).minor).toBe(30);
    expect(Money.fromMajor(19.99, 'USD').toDecimal()).toBe('19.99');
  });

  it('formats negatives and small values', () => {
    expect(Money.fromMinor(-5, 'USD').toDecimal()).toBe('-0.05');
    expect(Money.fromMinor(100000, 'USD').toDecimal()).toBe('1000.00');
  });

  it('rejects mixed currencies and bad input', () => {
    expect(() => Money.fromMinor(1, 'USD').add(Money.fromMinor(1, 'EUR'))).toThrow();
    expect(() => Money.fromMajor(NaN, 'USD')).toThrow();
  });

  it('allocates 100.00 three ways, giving the extra cent to the first', () => {
    const parts = Money.fromMajor(100, 'USD').allocate([1, 1, 1]);
    expect(parts.map((p) => p.minor)).toEqual([3334, 3333, 3333]);
  });

  it('allocation always sums to the total and stays within 1 cent of ideal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (minor, weights) => {
          const parts = Money.fromMinor(minor, 'USD').allocate(weights);
          const sum = parts.reduce((a, p) => a + p.minor, 0);
          const weightTotal = weights.reduce((a, b) => a + b, 0);
          expect(sum).toBe(minor);
          parts.forEach((p, i) => {
            expect(Math.abs(p.minor - (minor * weights[i]) / weightTotal)).toBeLessThan(1);
          });
        },
      ),
    );
  });
});
