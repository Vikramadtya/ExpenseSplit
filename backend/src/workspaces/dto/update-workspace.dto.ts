import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { currencyCode } from '../../common/money/currency-code.schema';

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  defaultCurrency: currencyCode.optional(),
});

export class UpdateWorkspaceDto extends createZodDto(updateWorkspaceSchema) {}
