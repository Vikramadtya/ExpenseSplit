/**
 * Currency helpers. How many decimals a currency has (0 for yen, 2 for dollars, 3 for dinars) is
 * taken from the browser's standards data, so every amount in the app is shown, typed and
 * converted to minor units with the right precision.
 */
const digitsCache = new Map<string, number>();

/** Decimal places in the currency's minor unit. Unknown codes fall back to 2. */
export const fractionDigits = (currency: string = 'USD'): number => {
  const code = currency.toUpperCase();
  let digits = digitsCache.get(code);
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).resolvedOptions()
          .maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitsCache.set(code, digits);
  }
  return digits;
};

/** An amount as a whole number of minor units (cents, yen, fils). Safe against float noise. */
export const toMinor = (value: number | string, currency: string = 'USD'): number =>
  Math.round(Number((Number(value || 0) * 10 ** fractionDigits(currency)).toPrecision(15)));

export const fromMinor = (minor: number, currency: string = 'USD'): number =>
  minor / 10 ** fractionDigits(currency);

/** The `step` for an amount input: 1 for yen, 0.01 for dollars, 0.001 for dinars. */
export const inputStep = (currency: string = 'USD'): string => {
  const digits = fractionDigits(currency);
  return digits === 0 ? '1' : `0.${'0'.repeat(digits - 1)}1`;
};

/** True when the typed amount has no more decimals than the currency allows. */
export const hasValidPrecision = (value: number | string, currency: string = 'USD'): boolean => {
  const scaled = Number(value) * 10 ** fractionDigits(currency);
  return Number.isInteger(Number(scaled.toPrecision(15)));
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  try {
    // Locale undefined = the reader's own: grouping and symbol placement follow their convention.
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const getCurrencySymbol = (currency: string = 'USD'): string => {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
};

/** Are two amounts equal to the minor unit of the currency (no float tolerance guesses)? */
export const sameAmount = (a: number, b: number, currency: string = 'USD'): boolean =>
  toMinor(a, currency) === toMinor(b, currency);
