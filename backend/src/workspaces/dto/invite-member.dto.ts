import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const InviteMemberSchema = z.object({
  email: z.string().email(),
});

export class InviteMemberDto extends createZodDto(InviteMemberSchema) {}
