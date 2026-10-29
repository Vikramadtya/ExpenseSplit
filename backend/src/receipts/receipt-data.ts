import { z } from 'zod';

/** What an OCR provider must return for one receipt. All numbers are plain decimals. */
export const receiptSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable().describe('Purchase date as yyyy-mm-dd, if printed'),
  currency: z.string().nullable().describe('ISO 4217 code such as USD, only if it can be told'),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number().describe('Total price of this line (quantity x unit price)'),
    }),
  ),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  total: z.number().nullable().describe('The final amount charged'),
});

export type ReceiptData = z.infer<typeof receiptSchema>;
