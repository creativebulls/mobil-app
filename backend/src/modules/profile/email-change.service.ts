import { AppError } from '../../shared/errors/AppError';
import { sendEmailChangeCode } from '../../shared/services/email.service';
import { generateNumericCode, hashValue } from '../../shared/utils/crypto';
import { emitToUser } from '../../socket/index';
import { serializeUser, User } from '../users/user.model';
import { EmailChange, type EmailChangeDocument } from './email-change.model';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return email;
  }

  if (local.length <= 2) {
    return `${local[0] ?? ''}***@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}

async function getUserOrThrow(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

export async function sendCurrentEmailChangeCode(userId: string) {
  const user = await getUserOrThrow(userId);
  const code = generateNumericCode(6);

  await EmailChange.findOneAndUpdate(
    { userId },
    {
      userId,
      currentEmail: user.email,
      currentCodeHash: hashValue(code),
      currentCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      currentAttempts: 0,
      currentVerified: false,
      sessionExpiresAt: undefined,
      newEmail: undefined,
      newCodeHash: undefined,
      newCodeExpiresAt: undefined,
      newAttempts: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await sendEmailChangeCode(user.email, code, 'current');

  return {
    message: 'Verification code sent to your current email',
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: CODE_TTL_MS / 1000,
  };
}

export async function verifyCurrentEmailChangeCode(userId: string, code: string) {
  const record = await EmailChange.findOne({ userId });

  if (
    !record ||
    !record.currentCodeHash ||
    !record.currentCodeExpiresAt ||
    record.currentCodeExpiresAt <= new Date()
  ) {
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_EMAIL_CHANGE_CODE');
  }

  if (record.currentAttempts >= MAX_ATTEMPTS) {
    throw new AppError(429, 'Too many invalid attempts. Request a new code.', 'EMAIL_CHANGE_ATTEMPTS_EXCEEDED');
  }

  if (record.currentCodeHash !== hashValue(code)) {
    record.currentAttempts += 1;
    await record.save();
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_EMAIL_CHANGE_CODE');
  }

  record.currentVerified = true;
  record.sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
  record.currentCodeHash = undefined;
  record.currentCodeExpiresAt = undefined;
  record.currentAttempts = 0;
  await record.save();

  return {
    message: 'Current email verified',
    sessionExpiresInSeconds: SESSION_TTL_MS / 1000,
  };
}

function assertCurrentEmailVerified(record: EmailChangeDocument | null) {
  if (!record?.currentVerified || !record.sessionExpiresAt || record.sessionExpiresAt <= new Date()) {
    throw new AppError(403, 'Verify your current email first', 'EMAIL_CHANGE_STEP_REQUIRED');
  }
}

export async function sendNewEmailChangeCode(userId: string, newEmail: string) {
  const user = await getUserOrThrow(userId);
  const record = await EmailChange.findOne({ userId });
  assertCurrentEmailVerified(record);

  const normalizedEmail = newEmail.toLowerCase();

  if (normalizedEmail === user.email) {
    throw new AppError(400, 'New email must be different from your current email', 'EMAIL_UNCHANGED');
  }

  const taken = await User.findOne({ email: normalizedEmail });
  if (taken) {
    throw new AppError(409, 'Email is already in use', 'EMAIL_TAKEN');
  }

  const code = generateNumericCode(6);

  record!.newEmail = normalizedEmail;
  record!.newCodeHash = hashValue(code);
  record!.newCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
  record!.newAttempts = 0;
  await record!.save();

  await sendEmailChangeCode(normalizedEmail, code, 'new');

  return {
    message: 'Verification code sent to your new email',
    maskedEmail: maskEmail(normalizedEmail),
    expiresInSeconds: CODE_TTL_MS / 1000,
  };
}

export async function confirmEmailChange(userId: string, newEmail: string, code: string) {
  const user = await getUserOrThrow(userId);
  const record = await EmailChange.findOne({ userId });
  assertCurrentEmailVerified(record);

  const normalizedEmail = newEmail.toLowerCase();

  if (record!.newEmail !== normalizedEmail) {
    throw new AppError(400, 'Request a verification code for this email first', 'EMAIL_CHANGE_MISMATCH');
  }

  if (
    !record!.newCodeHash ||
    !record!.newCodeExpiresAt ||
    record!.newCodeExpiresAt <= new Date()
  ) {
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_EMAIL_CHANGE_CODE');
  }

  if (record!.newAttempts >= MAX_ATTEMPTS) {
    throw new AppError(429, 'Too many invalid attempts. Request a new code.', 'EMAIL_CHANGE_ATTEMPTS_EXCEEDED');
  }

  if (record!.newCodeHash !== hashValue(code)) {
    record!.newAttempts += 1;
    await record!.save();
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_EMAIL_CHANGE_CODE');
  }

  const taken = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
  if (taken) {
    throw new AppError(409, 'Email is already in use', 'EMAIL_TAKEN');
  }

  user.email = normalizedEmail;
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  await EmailChange.deleteOne({ userId });

  const serialized = serializeUser(user);
  emitToUser(userId, 'user:profile-updated', { user: serialized });

  return {
    message: 'Email updated successfully',
    user: serialized,
  };
}
