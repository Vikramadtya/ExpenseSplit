import { z } from 'zod';
import { Currency } from './currency';

/** An ISO 4217 code, any case in, upper case out. Unknown codes fail validation (a 400). */
export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => Currency.isValid(code), 'Unknown currency code');
