import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(3, 'Workspace name must be at least 3 characters').max(100),
  defaultCurrency: z.string().optional().default('USD'),
});

export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceSchema) {}
