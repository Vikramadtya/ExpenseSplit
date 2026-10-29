import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const userId = z.string().uuid();
const money = z.number().finite().max(9_999_999_999);

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1).max(255),
  amount: money.positive(),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']).default('EQUAL'),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((c) => c.toUpperCase())
    .default('USD'),
  type: z.enum(['EXPENSE', 'TRANSFER']).default('EXPENSE'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  recurringInterval: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),

  payers: z
    .array(z.object({ userId, amount: money.positive() }))
    .min(1)
    .max(100),

  participants: z.array(userId).max(100).optional(),
  exactAmounts: z
    .array(z.object({ userId, amount: money.min(0) }))
    .max(100)
    .optional(),
  percentages: z
    .array(z.object({ userId, percentage: z.number().min(0).max(100) }))
    .max(100)
    .optional(),
  shares: z
    .array(z.object({ userId, shares: z.number().min(0).max(10_000) }))
    .max(100)
    .optional(),
});

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}
