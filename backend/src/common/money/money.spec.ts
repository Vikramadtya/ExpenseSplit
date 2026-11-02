import fc from 'fast-check';
import { InvalidMoneyError, Money } from './money';

describe('Money', () => {
  it('parses decimals without float drift', () => {
    expect(Money.fromMajor(1.1, 'USD').minor).toBe(110);
    expect(Money.fromMajor('0.1', 'USD').add(Money.fromMajor('0.2', 'USD')).minor).toBe(30);
    expect(Money.fromMajor(19.99, 'USD').toDecimal()).toBe('19.99');
  });

  it('formats negatives and small values', () => {
    expect(Money.fromMinor(-5, 'USD').toDecimal()).toBe('-0.05');
    expect(Money.fromMinor(100000, 'USD').toDecimal()).toBe('1000.00');
  });

  it('rejects mixed currencies and bad input', () => {
    expect(() => Money.fromMinor(1, 'USD').add(Money.fromMinor(1, 'EUR'))).toThrow(
      InvalidMoneyError,
    );
    expect(() => Money.fromMajor(NaN, 'USD')).toThrow(InvalidMoneyError);
    expect(() => Money.fromMajor(1, 'XYZ')).toThrow(InvalidMoneyError);
  });

  describe('currencies with other decimal places', () => {
    it('treats yen as whole numbers: no cents exist', () => {
      expect(Money.fromMajor(1500, 'JPY').minor).toBe(1500);
      expect(Money.fromMajor(1500, 'JPY').toDecimal()).toBe('1500');
      expect(Money.fromMajor(1500, 'JPY').toMajor()).toBe(1500);
      expect(() => Money.fromMajor(10.5, 'JPY')).toThrow(/no decimal places/);
    });

    it('keeps three decimals for dinars', () => {
      expect(Money.fromMajor('1.234', 'KWD').minor).toBe(1234);
      expect(Money.fromMajor(1.234, 'KWD').toDecimal()).toBe('1.234');
      expect(Money.fromMinor(5, 'KWD').toDecimal()).toBe('0.005');
      expect(Money.fromMinor(-1500, 'KWD').toDecimal()).toBe('-1.500');
      expect(() => Money.fromMajor(1.2345, 'KWD')).toThrow(/at most 3 decimal places/);
    });

    it('rejects too many decimals instead of silently rounding', () => {
      expect(() => Money.fromMajor(1.005, 'USD')).toThrow(/at most 2 decimal places/);
      expect(() => Money.fromMajor('19.999', 'USD')).toThrow(InvalidMoneyError);
      expect(Money.fromMajorRounded(1.005, 'USD').minor).toBe(101);
      expect(Money.fromMajorRounded(10.5, 'JPY').minor).toBe(11);
    });

    it('formats with the right number of decimals, including negatives and zero', () => {
      expect(Money.fromMinor(0, 'USD').toDecimal()).toBe('0.00');
      expect(Money.fromMinor(0, 'JPY').toDecimal()).toBe('0');
      expect(Money.fromMinor(-5, 'USD').toDecimal()).toBe('-0.05');
      expect(Money.fromMinor(-7, 'JPY').toDecimal()).toBe('-7');
    });

    it('splits 100 yen three ways into whole yen that add up', () => {
      expect(
        Money.fromMajor(100, 'JPY')
          .allocate([1, 1, 1])
          .map((p) => p.minor),
      ).toEqual([34, 33, 33]);
      expect(
        Money.fromMajor(1, 'KWD')
          .allocate([1, 1, 1])
          .map((p) => p.minor),
      ).toEqual([334, 333, 333]);
    });

    it('converts across different decimal places', () => {
      // 100.00 USD at 150 JPY per USD = 15,000 JPY (whole yen), not 1,500,000
      expect(Money.fromMajor(100, 'USD').convertTo('JPY', 150).minor).toBe(15000);
      // 1500 JPY at 0.0067 USD per JPY = 10.05 USD
      expect(Money.fromMajor(1500, 'JPY').convertTo('USD', 0.0067).toDecimal()).toBe('10.05');
      // 10.00 USD at 0.307 KWD per USD = 3.070 KWD
      expect(Money.fromMajor(10, 'USD').convertTo('KWD', 0.307).toDecimal()).toBe('3.070');
      expect(() => Money.fromMajor(1, 'USD').convertTo('EUR', 0)).toThrow(InvalidMoneyError);
    });
  });

  it('allocates 100.00 three ways, giving the extra cent to the first', () => {
    const parts = Money.fromMajor(100, 'USD').allocate([1, 1, 1]);
    expect(parts.map((p) => p.minor)).toEqual([3334, 3333, 3333]);
  });

  it('allocation always sums to the total and stays within 1 minor unit of ideal, in any currency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('USD', 'JPY', 'KWD', 'EUR', 'CLP', 'BHD'),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (currency, minor, weights) => {
          const parts = Money.fromMinor(minor, currency).allocate(weights);
          const sum = parts.reduce((a, p) => a + p.minor, 0);
          const weightTotal = weights.reduce((a, b) => a + b, 0);
          expect(sum).toBe(minor);
          parts.forEach((p, i) => {
            expect(p.currency).toBe(currency);
            expect(Math.abs(p.minor - (minor * weights[i]) / weightTotal)).toBeLessThan(1);
          });
        },
      ),
    );
  });

  it('round-trips through its decimal string in every currency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('USD', 'JPY', 'KWD', 'INR'),
        fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
        (currency, minor) => {
          const money = Money.fromMinor(minor, currency);
          expect(Money.fromMajor(money.toDecimal(), currency).minor).toBe(minor);
          expect(money.toDecimal().split('.')[1]?.length ?? 0).toBe(money.exponent);
        },
      ),
    );
  });
});
