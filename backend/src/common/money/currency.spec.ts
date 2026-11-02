import { Currency, InvalidMoneyError } from './currency';

describe('Currency', () => {
  it.each([
    ['USD', 2],
    ['EUR', 2],
    ['INR', 2],
    ['JPY', 0],
    ['KRW', 0],
    ['CLP', 0],
    ['VND', 0],
    ['KWD', 3],
    ['BHD', 3],
    ['OMR', 3],
    ['JOD', 3],
    ['TND', 3],
  ])('%s has %i decimal places (ISO 4217)', (code, exponent) => {
    expect(Currency.of(code).exponent).toBe(exponent);
  });

  it('is case-insensitive and exposes the standard name and symbol', () => {
    const yen = Currency.of('jpy');
    expect(yen.code).toBe('JPY');
    expect(yen.name).toBe('Japanese Yen');
    expect(yen.symbol).toBe('¥');
    expect(Currency.of('USD').symbol).toBe('$');
  });

  it('rejects codes that are not currencies, including malformed ones', () => {
    for (const bad of ['XYZ', 'ZZZ', 'US', 'USDX', '', '   ', 'XXX', 'XAU', 'XDR', '$$$', '12']) {
      expect(Currency.isValid(bad)).toBe(false);
      expect(() => Currency.of(bad)).toThrow(InvalidMoneyError);
    }
    expect(Currency.isValid(undefined)).toBe(false);
    expect(Currency.isValid(840)).toBe(false);
  });

  it('lists every currency once, sorted, with consistent data', () => {
    const all = Currency.all();
    expect(all.length).toBeGreaterThan(140);
    expect(new Set(all.map((c) => c.code)).size).toBe(all.length);
    expect(all.map((c) => c.code)).toEqual([...all.map((c) => c.code)].sort());
    expect(all.every((c) => /^[A-Z]{3}$/.test(c.code) && [0, 2, 3].includes(c.exponent))).toBe(
      true,
    );
  });

  it('rounds and writes numbers to the currency precision', () => {
    expect(Currency.of('USD').round(1.005)).toBe(1.01);
    expect(Currency.of('JPY').round(10.5)).toBe(11);
    expect(Currency.of('KWD').round(1.23456)).toBe(1.235);
    expect(Currency.of('USD').fixed(5)).toBe('5.00');
    expect(Currency.of('JPY').fixed(5)).toBe('5');
    expect(Currency.of('KWD').fixed(5)).toBe('5.000');
  });
});
