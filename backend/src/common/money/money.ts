import { Currency, InvalidMoneyError } from './currency';

export { Currency, InvalidMoneyError } from './currency';

/** Percentages and share counts are weighted to at most this many hundredths. */
const WEIGHT_SCALE = 100;

/**
 * Immutable money: an integer number of the currency's minor units (cents, yen, fils...) plus
 * an ISO 4217 currency. How many decimals the currency has comes from the currency itself, so
 * 100 JPY is 100 minor units but 100 USD is 10,000. Integer arithmetic keeps sums exact.
 *
 * Rounding, where a conversion forces one, is half up to the nearest minor unit.
 */
export class Money {
  private constructor(
    readonly minor: number,
    /** Upper-case ISO 4217 code. */
    readonly currency: string,
    private readonly cur: Currency,
  ) {}

  /** How many decimals this amount's currency has. */
  get exponent(): number {
    return this.cur.exponent;
  }

  static fromMinor(minor: number, currency: string): Money {
    const cur = Currency.of(currency);
    if (!Number.isSafeInteger(minor)) throw new InvalidMoneyError(`Invalid amount: ${minor}`);
    return new Money(minor, cur.code, cur);
  }

  /**
   * An amount as people write it ("12.34", 12.34). More decimals than the currency has is an
   * error, not a silent rounding: 10.5 JPY or 1.234 USD is rejected.
   */
  static fromMajor(amount: number | string, currency: string): Money {
    const cur = Currency.of(currency);
    const value = Number(amount);
    if (!Number.isFinite(value)) throw new InvalidMoneyError(`Invalid amount: ${String(amount)}`);
    // toPrecision strips binary noise first, so 1.1 * 100 is 110, not 110.00000000000001.
    const scaled = Number((value * cur.factor).toPrecision(15));
    if (!Number.isInteger(scaled)) {
      const places =
        cur.exponent === 0 ? 'no decimal places' : `at most ${cur.exponent} decimal places`;
      throw new InvalidMoneyError(`${cur.code} amounts have ${places}`);
    }
    return Money.fromMinor(scaled, cur.code);
  }

  /** Like fromMajor, but rounds extra decimals to the nearest minor unit (for converted values). */
  static fromMajorRounded(amount: number | string, currency: string): Money {
    const cur = Currency.of(currency);
    const value = Number(amount);
    if (!Number.isFinite(value)) throw new InvalidMoneyError(`Invalid amount: ${String(amount)}`);
    return Money.fromMinor(Math.round(Number((value * cur.factor).toPrecision(15))), cur.code);
  }

  static zero(currency: string): Money {
    return Money.fromMinor(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency, this.cur);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency, this.cur);
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  /** As a plain number in major units (1234 USD minor -> 12.34). For JSON responses. */
  toMajor(): number {
    return this.minor / this.cur.factor;
  }

  /** Exact decimal string with the currency's own number of decimals: "12.34" (USD), "12" (JPY). */
  toDecimal(): string {
    const sign = this.minor < 0 ? '-' : '';
    const abs = Math.abs(this.minor);
    if (this.cur.exponent === 0) return `${sign}${abs}`;
    const factor = this.cur.factor;
    return `${sign}${Math.floor(abs / factor)}.${String(abs % factor).padStart(this.cur.exponent, '0')}`;
  }

  /** The same value in another currency at `rate` (units of the target per one of this), rounded to a minor unit. */
  convertTo(target: string, rate: number): Money {
    const to = Currency.of(target);
    if (!(rate > 0) || !Number.isFinite(rate)) throw new InvalidMoneyError('Invalid exchange rate');
    return Money.fromMinor(Math.round((this.minor / this.cur.factor) * rate * to.factor), to.code);
  }

  /**
   * Splits this amount in proportion to `weights` using the largest-remainder method: the parts
   * always sum to the original amount, to the minor unit.
   */
  allocate(weights: number[]): Money[] {
    if (this.minor < 0) throw new InvalidMoneyError('Cannot allocate a negative amount');
    if (weights.length === 0) throw new InvalidMoneyError('At least one weight is required');

    // Weights may carry up to 2 decimals (percentages, fractional shares).
    const scaled = weights.map((w) => BigInt(Math.round(w * WEIGHT_SCALE)));
    if (scaled.some((w) => w < 0n)) throw new InvalidMoneyError('Weights must not be negative');
    const totalWeight = scaled.reduce((a, b) => a + b, 0n);
    if (totalWeight === 0n) throw new InvalidMoneyError('Weights must not all be zero');

    const total = BigInt(this.minor);
    const parts = scaled.map((w) => ({
      floor: (total * w) / totalWeight,
      rem: (total * w) % totalWeight,
    }));
    let leftover = Number(total - parts.reduce((sum, p) => sum + p.floor, 0n));

    const byRemainder = parts
      .map((p, index) => ({ index, rem: p.rem }))
      .sort((a, b) => (a.rem === b.rem ? a.index - b.index : a.rem > b.rem ? -1 : 1));
    const bonus = new Array<number>(weights.length).fill(0);
    for (const { index } of byRemainder) {
      if (leftover-- <= 0) break;
      bonus[index] = 1;
    }

    return parts.map((p, i) => new Money(Number(p.floor) + bonus[i], this.currency, this.cur));
  }

  private assertSameCurrency(other: Money) {
    if (other.currency !== this.currency) {
      throw new InvalidMoneyError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
