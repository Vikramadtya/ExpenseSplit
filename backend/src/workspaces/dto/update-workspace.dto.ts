import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  defaultCurrency: z.string().length(3).optional(),
});

export class UpdateWorkspaceDto extends createZodDto(updateWorkspaceSchema) {}
