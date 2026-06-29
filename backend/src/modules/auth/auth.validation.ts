import { z } from 'zod';

export const emailSchema = z.string().trim().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password is too long');

export const registerPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[A-Z]/, 'Password must include an uppercase letter');

export const accountTypeSchema = z.enum(['individual', 'business']);

export const registerSchema = z.object({
  email: emailSchema,
  password: registerPasswordSchema,
  termsConsent: z.literal(true, {
    errorMap: () => ({ message: 'Terms consent is required' }),
  }),
  accountType: accountTypeSchema.default('individual'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyResetCodeSchema = z.object({
  email: emailSchema,
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const updateNamesSchema = z.object({
  givenName: z.string().trim().min(1, 'Given name is required'),
  surname: z.string().trim().min(1, 'Surname is required'),
});

export const parentalConsentSchema = z.object({
  parentalConsent: z.literal(true, {
    errorMap: () => ({ message: 'Parental consent is required' }),
  }),
});

export const completeRegistrationSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  birthdate: z.string().datetime({ message: 'Invalid birthdate' }),
  gender: z.string().trim().min(1, 'Gender is required'),
  termsConsent: z.literal(true, {
    errorMap: () => ({ message: 'Terms consent is required' }),
  }),
  parentalConsent: z.boolean().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const resumeVerifiedSessionSchema = z.object({
  pendingSessionToken: z.string().min(1, 'Pending session token is required'),
});

export const appleLoginSchema = z.object({
  idToken: z.string().min(1, 'Apple identity token is required'),
  givenName: z.string().trim().optional().nullable(),
  surname: z.string().trim().optional().nullable(),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Google identity token is required'),
});
