import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { NOTIFICATION_KINDS } from '../../notifications/notification-message';

/** `null` clears a handle; omitted fields stay as they are. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  /** Notification kinds to switch off (in-app, push and email). */
  mutedNotificationKinds: z
    .array(z.enum(NOTIFICATION_KINDS as [string, ...string[]]))
    .max(20)
    .optional(),
  upiVpa: z
    .string()
    .regex(/^[\w.-]{2,256}@[\w.-]{2,64}$/, 'Expected something like name@bank')
    .nullable()
    .optional(),
  paypalMe: z
    .string()
    .regex(/^[A-Za-z0-9]{1,20}$/, 'Just the handle from paypal.me/<handle>')
    .nullable()
    .optional(),
  venmoHandle: z
    .string()
    .regex(/^[A-Za-z0-9_-]{5,30}$/, 'Venmo username without the @')
    .nullable()
    .optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
