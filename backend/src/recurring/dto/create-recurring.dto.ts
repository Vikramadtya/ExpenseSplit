import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createExpenseSchema } from '../../expenses/dto/create-expense.dto';

const schema = createExpenseSchema.omit({ date: true, recurringInterval: true }).extend({
  /** Date of the first occurrence. */
  startDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
  interval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
});

export class CreateRecurringDto extends createZodDto(schema) {}
