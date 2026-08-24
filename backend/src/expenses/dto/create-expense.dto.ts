import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string(), // ISO date string
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']).default('EQUAL'),
  category: z.string().optional(),
  currency: z.string().default('USD'),
  type: z.enum(['EXPENSE', 'TRANSFER']).default('EXPENSE'),
  tags: z.array(z.string()).optional(),
  recurringInterval: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),

  payers: z.array(z.object({ userId: z.string().uuid(), amount: z.number().positive() })).min(1),

  groupId: z.string().uuid(), // Now requires a groupId or workspaceId in the DTO? Wait, the frontend is sending groupId: workspaceId right now in AddExpenseModal. Let's make it optional string for now.
  participants: z.array(z.string().uuid()).optional(),
  exactAmounts: z.array(z.object({ userId: z.string().uuid(), amount: z.number() })).optional(),
  percentages: z.array(z.object({ userId: z.string().uuid(), percentage: z.number() })).optional(),
});

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}
