import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  date: z.string(), // normally z.date() or ISO string
  paidBy: z.string().uuid('Paid By must be a valid member UUID'),
});

export class CreateExpenseDto extends createZodDto(CreateExpenseSchema) {}
