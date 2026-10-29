import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class UpdateMemberRoleDto extends createZodDto(
  z.object({ role: z.enum(['ADMIN', 'MEMBER']) }),
) {}
