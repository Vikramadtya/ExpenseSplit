import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const date = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');

export class AnalyticsQueryDto extends createZodDto(
  z.object({
    from: date.optional(),
    to: date.optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  }),
) {}

export type GroupBy = 'day' | 'week' | 'month';
