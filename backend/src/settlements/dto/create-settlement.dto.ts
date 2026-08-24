import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createSettlementSchema = z.object({
  payerId: z.string().uuid(),
  payeeId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
});

export class CreateSettlementDto extends createZodDto(createSettlementSchema) {}
