import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { currencyCode } from '../common/money/currency-code.schema';

const date = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');

export class AnalyticsQueryDto extends createZodDto(
  z.object({
    from: date.optional(),
    to: date.optional(),
    currency: currencyCode.optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  }),
) {}

export type GroupBy = 'day' | 'week' | 'month';
