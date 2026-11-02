/** Thrown for anything wrong with a currency or an amount in it. The HTTP layer turns it into a 400. */
export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

// Accounting units that Intl lists but nobody pays with: IMF Special Drawing Rights, the Ecuadorian sucre.
const NOT_FOR_PAYMENTS = new Set(['XDR', 'XSU']);

/**
 * An ISO 4217 currency: its code and how many decimal places its minor unit has (USD 2, JPY 0,
 * KWD 3). The data comes from the runtime's standards database (Intl/CLDR) rather than a table
 * kept by hand, so new currencies and exponent changes arrive with the runtime.
 */
export class Currency {
  private static byCode?: Map<string, Currency>;

  private constructor(
    readonly code: string,
    /** Decimal places in the minor unit. */
    readonly exponent: number,
    readonly name: string,
    readonly symbol: string,
  ) {}

  private static registry(): Map<string, Currency> {
    if (!Currency.byCode) {
      const names = new Intl.DisplayNames('en', { type: 'currency' });
      Currency.byCode = new Map(
        Intl.supportedValuesOf('currency')
          .filter((code) => !NOT_FOR_PAYMENTS.has(code))
          .map((code) => {
            const format = new Intl.NumberFormat('en', {
              style: 'currency',
              currency: code,
              currencyDisplay: 'narrowSymbol',
            });
            const symbol =
              format.formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
            return [
              code,
              new Currency(
                code,
                format.resolvedOptions().maximumFractionDigits ?? 2,
                names.of(code) ?? code,
                symbol,
              ),
            ];
          }),
      );
    }
    return Currency.byCode;
  }

  /** Is this a known currency code? Case-insensitive. */
  static isValid(code: unknown): code is string {
    return typeof code === 'string' && Currency.registry().has(code.toUpperCase());
  }

  /** The currency for a code (any case). Throws InvalidMoneyError for anything unknown. */
  static of(code: string): Currency {
    const currency =
      typeof code === 'string' ? Currency.registry().get(code.toUpperCase()) : undefined;
    if (!currency) throw new InvalidMoneyError(`Unknown currency "${String(code).slice(0, 10)}"`);
    return currency;
  }

  static all(): Currency[] {
    return [...Currency.registry().values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  /** Minor units per major unit: 100 for USD, 1 for JPY, 1000 for KWD. */
  get factor(): number {
    return 10 ** this.exponent;
  }

  /** Rounds a plain number to this currency's precision (half up). For display and aggregates. */
  round(value: number): number {
    return Math.round(Number((value * this.factor).toPrecision(15))) / this.factor;
  }

  /** Writes a number with exactly this currency's decimals, e.g. 5 -> "5.00" (USD), "5" (JPY). */
  fixed(value: number): string {
    return value.toFixed(this.exponent);
  }
}
