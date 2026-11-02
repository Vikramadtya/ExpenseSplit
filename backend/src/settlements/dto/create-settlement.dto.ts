import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { currencyCode } from '../../common/money/currency-code.schema';

const createSettlementSchema = z.object({
  payerId: z.string().uuid(),
  payeeId: z.string().uuid(),
  amount: z.number().finite().positive().max(9_999_999_999),
  /** Defaults to the workspace currency. */
  currency: currencyCode.optional(),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
});

export class CreateSettlementDto extends createZodDto(createSettlementSchema) {}
