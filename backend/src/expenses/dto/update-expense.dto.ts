import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const updateExpenseSchema = z.object({
  groupId: z.string().uuid().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']).optional(),
  currency: z.string().optional(),
  paidBy: z.string().uuid().optional(),
  participants: z.array(z.string().uuid()).min(1).optional(),
  exactAmounts: z.array(z.object({ userId: z.string().uuid(), amount: z.number() })).optional(),
});

export class UpdateExpenseDto extends createZodDto(updateExpenseSchema) {}
