import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .transform((value) => value.toLowerCase());

export const updatePersonalInfoSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(50).optional(),
    lastName: z.string().trim().min(1, 'Last name is required').max(50).optional(),
    username: usernameSchema.optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.username !== undefined,
    { message: 'No profile fields provided' },
  );

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;

export const emailChangeCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .length(6, 'Enter the 6-digit verification code')
    .regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
});

export const emailChangeNewEmailSchema = z.object({
  newEmail: z.string().trim().email('Enter a valid email'),
});

export const emailChangeConfirmSchema = emailChangeNewEmailSchema.merge(emailChangeCodeSchema);
