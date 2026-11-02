import { useQuery } from '@tanstack/react-query';
import { listCurrenciesOptions } from '../../api/@tanstack/react-query.gen';
import { fractionDigits } from '../../utils/currency';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  exponent: number;
}

/** Used until the server's list arrives (or offline): the browser's own standards data. */
function fallbackCurrencies(): CurrencyInfo[] {
  try {
    const names = new Intl.DisplayNames(undefined, { type: 'currency' });
    return Intl.supportedValuesOf('currency')
      .filter((code) => code !== 'XDR' && code !== 'XSU')
      .map((code) => ({
        code,
        name: names.of(code) ?? code,
        symbol: code,
        exponent: fractionDigits(code),
      }));
  } catch {
    return ['USD', 'EUR', 'GBP', 'INR', 'JPY'].map((code) => ({
      code,
      name: code,
      symbol: code,
      exponent: fractionDigits(code),
    }));
  }
}

const FALLBACK = fallbackCurrencies();

/** Every supported ISO 4217 currency, from the server (which is the source of truth). */
export function useCurrencies(): CurrencyInfo[] {
  const { data } = useQuery({
    ...listCurrenciesOptions(),
    staleTime: Infinity, // changes only with a runtime upgrade
    placeholderData: FALLBACK,
  });
  return data ?? FALLBACK;
}
