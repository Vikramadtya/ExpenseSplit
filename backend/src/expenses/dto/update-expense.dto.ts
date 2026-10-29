import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createExpenseSchema } from './create-expense.dto';

// Defaults are dropped so an omitted field means "leave unchanged".
const updateExpenseSchema = z.object({
  description: createExpenseSchema.shape.description.optional(),
  amount: createExpenseSchema.shape.amount.optional(),
  date: createExpenseSchema.shape.date.optional(),
  splitType: createExpenseSchema.shape.splitType.removeDefault().optional(),
  category: createExpenseSchema.shape.category.removeDefault().optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((c) => c.toUpperCase())
    .optional(),
  tags: createExpenseSchema.shape.tags,
  payers: createExpenseSchema.shape.payers.optional(),
  /** Shorthand for a single payer covering the whole amount. Ignored when `payers` is given. */
  paidBy: z.string().uuid().optional(),
  participants: createExpenseSchema.shape.participants,
  exactAmounts: createExpenseSchema.shape.exactAmounts,
  percentages: createExpenseSchema.shape.percentages,
  shares: createExpenseSchema.shape.shares,
  items: createExpenseSchema.shape.items,
  tax: createExpenseSchema.shape.tax,
  tip: createExpenseSchema.shape.tip,
  /** Optimistic locking: the update fails with 409 if the expense changed since this version. */
  expectedVersion: z.number().int().positive().optional(),
});

export class UpdateExpenseDto extends createZodDto(updateExpenseSchema) {}
