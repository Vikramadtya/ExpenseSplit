/**
 * Immutable money value object. Amounts are held as integer minor units (cents)
 * so arithmetic is exact; the API and DB boundary still use 2-decimal values.
 */
export class Money {
  private static readonly SCALE = 100;

  private constructor(
    readonly minor: number,
    readonly currency: string,
  ) {}

  static fromMinor(minor: number, currency: string): Money {
    if (!Number.isSafeInteger(minor)) throw new RangeError(`Invalid minor amount: ${minor}`);
    return new Money(minor, currency);
  }

  /** Accepts a number or a decimal string such as "12.34". */
  static fromMajor(amount: number | string, currency: string): Money {
    const value = Number(amount);
    if (!Number.isFinite(value)) throw new RangeError(`Invalid amount: ${amount}`);
    // toPrecision strips binary noise so 1.005 * 100 rounds to 101, not 100.
    return Money.fromMinor(Math.round(Number((value * Money.SCALE).toPrecision(15))), currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  toMajor(): number {
    return this.minor / Money.SCALE;
  }

  /** Exact decimal string for Postgres `numeric` columns. */
  toDecimal(): string {
    const sign = this.minor < 0 ? '-' : '';
    const abs = Math.abs(this.minor);
    return `${sign}${Math.floor(abs / Money.SCALE)}.${String(abs % Money.SCALE).padStart(2, '0')}`;
  }

  /**
   * Splits this amount in proportion to `weights` using the largest-remainder
   * method: the parts always sum to the original amount, to the cent.
   */
  allocate(weights: number[]): Money[] {
    if (this.minor < 0) throw new RangeError('Cannot allocate a negative amount');
    if (weights.length === 0) throw new RangeError('At least one weight is required');

    // Weights may carry up to 2 decimals (percentages, fractional shares).
    const scaled = weights.map((w) => BigInt(Math.round(w * Money.SCALE)));
    if (scaled.some((w) => w < 0n)) throw new RangeError('Weights must not be negative');
    const totalWeight = scaled.reduce((a, b) => a + b, 0n);
    if (totalWeight === 0n) throw new RangeError('Weights must not all be zero');

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

    return parts.map((p, i) => new Money(Number(p.floor) + bonus[i], this.currency));
  }

  private assertSameCurrency(other: Money) {
    if (other.currency !== this.currency) {
      throw new TypeError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
