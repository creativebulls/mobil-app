import bcrypt from 'bcryptjs';
import path from 'path';

import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { sendPasswordResetCode, sendVerificationEmail } from '../../shared/services/email.service';
import { calculateAge, generateNumericCode, generateToken, hashValue } from '../../shared/utils/crypto';
import {
  signAccessToken,
  signPasswordResetToken,
  signPendingSessionToken,
  signRefreshToken,
  verifyPendingSessionToken,
} from '../../shared/utils/jwt';
import { PasswordReset } from './password-reset.model';
import { User, serializeUser, type UserDocument } from '../users/user.model';
import { emitToUser, emitToPendingSession } from '../../socket/index';
import {
  verifyAppleIdentityToken,
  verifyGoogleIdentityToken,
} from './social-auth.service';
import { getAppConfig } from '../admin/admin.service';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
// Long-lived refresh tokens (rotated on each refresh) keep users signed in
// until they explicitly log out or clear the app cache.
const REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function buildAuthResponse(user: UserDocument, accessToken: string, refreshToken: string) {
  return {
    user: serializeUser(user),
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

async function issueTokens(user: UserDocument) {
  const tokenId = generateToken(16);
  const accessToken = signAccessToken(user._id.toString(), user.email);
  const refreshToken = signRefreshToken(user._id.toString(), tokenId);

  user.refreshTokens.push({
    tokenId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  user.refreshTokens = user.refreshTokens.filter((entry) => entry.expiresAt > new Date());
  await user.save();

  return { accessToken, refreshToken };
}

export async function registerUser(input: {
  email: string;
  password: string;
  termsConsent: true;
  profilePhotoUrl?: string;
  accountType?: 'individual' | 'business';
}) {
  const accountType = input.accountType ?? 'individual';

  if (accountType === 'business') {
    const { config } = await getAppConfig();
    if (config['registration.business_accounts_enabled'] !== 'true') {
      throw new AppError(
        403,
        'Business account registration is not available',
        'BUSINESS_ACCOUNTS_DISABLED',
      );
    }
  }

  const existing = await User.findOne({ email: input.email.toLowerCase() });

  if (existing) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const verificationToken = generateToken(24);

  const user = await User.create({
    email: input.email.toLowerCase(),
    passwordHash,
    profilePhotoUrl: input.profilePhotoUrl,
    accountType,
    emailVerified: false,
    emailVerificationToken: hashValue(verificationToken),
    emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    registrationStatus: 'pending_email',
    termsConsentAt: new Date(),
  });

  await sendVerificationEmail(user.email, verificationToken);

  const pendingSessionToken = signPendingSessionToken(user._id.toString(), user.email);

  return {
    user: serializeUser(user),
    pendingSessionToken,
    message: 'Verification email sent',
  };
}

export async function verifyEmail(token: string) {
  const user = await User.findOne({
    emailVerificationToken: hashValue(token),
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(400, 'Invalid or expired verification link', 'INVALID_VERIFICATION_TOKEN');
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  user.registrationStatus = 'pending_profile';
  await user.save();

  const { accessToken, refreshToken } = await issueTokens(user);

  emitToUser(user._id.toString(), 'auth:email-verified', {
    user: serializeUser(user),
    tokens: { accessToken, refreshToken },
  });

  emitToPendingSession(user._id.toString(), 'auth:email-verified', {
    user: serializeUser(user),
    tokens: { accessToken, refreshToken },
  });

  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function getVerificationStatus(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new AppError(404, 'Account not found', 'USER_NOT_FOUND');
  }

  return {
    email: user.email,
    emailVerified: user.emailVerified,
    registrationStatus: user.registrationStatus,
  };
}

export async function resumeVerifiedSession(pendingSessionToken: string) {
  const payload = verifyPendingSessionToken(pendingSessionToken);
  const user = await User.findById(payload.sub);

  if (!user || user.email !== payload.email) {
    throw new AppError(401, 'Invalid session', 'INVALID_SESSION');
  }

  if (!user.emailVerified) {
    throw new AppError(403, 'Email not verified yet', 'EMAIL_NOT_VERIFIED');
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function resendVerificationEmail(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return { message: 'If an account exists, a verification email has been sent' };
  }

  if (user.emailVerified) {
    throw new AppError(400, 'Email is already verified', 'EMAIL_ALREADY_VERIFIED');
  }

  const verificationToken = generateToken(24);
  user.emailVerificationToken = hashValue(verificationToken);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await user.save();

  await sendVerificationEmail(user.email, verificationToken);

  return { message: 'Verification email sent' };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.passwordHash) {
    throw new AppError(
      401,
      'This account uses Apple or Google sign-in',
      'SOCIAL_ACCOUNT',
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.emailVerified) {
    throw new AppError(403, 'Please verify your email before signing in', 'EMAIL_NOT_VERIFIED');
  }

  // Suspended users are still allowed to sign in so they can view their status
  // and submit an appeal; all feature routes are gated by `requireNotSuspended`.
  const { accessToken, refreshToken } = await issueTokens(user);

  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function refreshSession(refreshToken: string) {
  const { verifyRefreshToken } = await import('../../shared/utils/jwt');
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);

  if (!user) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const stored = user.refreshTokens.find(
    (entry) => entry.tokenId === payload.tokenId && entry.expiresAt > new Date(),
  );

  if (!stored) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenId !== payload.tokenId);
  const tokens = await issueTokens(user);

  return buildAuthResponse(user, tokens.accessToken, tokens.refreshToken);
}

export async function logoutUser(userId: string, refreshToken?: string) {
  const user = await User.findById(userId);

  if (!user) {
    return { message: 'Logged out' };
  }

  if (refreshToken) {
    try {
      const { verifyRefreshToken } = await import('../../shared/utils/jwt');
      const payload = verifyRefreshToken(refreshToken);
      user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenId !== payload.tokenId);
    } catch {
      user.refreshTokens = [];
    }
  } else {
    user.refreshTokens = [];
  }

  await user.save();
  return { message: 'Logged out' };
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  const genericMessage = 'If an account exists, a verification code has been sent';

  if (!user) {
    return { message: genericMessage };
  }

  const code = generateNumericCode(6);

  await PasswordReset.findOneAndUpdate(
    { email: user.email },
    {
      email: user.email,
      codeHash: hashValue(code),
      expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      attempts: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await sendPasswordResetCode(user.email, code);

  emitToUser(user._id.toString(), 'auth:password-reset-code-sent', {
    email: user.email,
    expiresInSeconds: RESET_CODE_TTL_MS / 1000,
  });

  return { message: genericMessage };
}

export async function verifyPasswordResetCode(email: string, code: string) {
  const resetRecord = await PasswordReset.findOne({ email: email.toLowerCase() });

  if (!resetRecord || resetRecord.expiresAt <= new Date()) {
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_RESET_CODE');
  }

  if (resetRecord.attempts >= MAX_RESET_ATTEMPTS) {
    throw new AppError(429, 'Too many invalid attempts. Request a new code.', 'RESET_ATTEMPTS_EXCEEDED');
  }

  if (resetRecord.codeHash !== hashValue(code)) {
    resetRecord.attempts += 1;
    await resetRecord.save();
    throw new AppError(400, 'Invalid or expired verification code', 'INVALID_RESET_CODE');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new AppError(404, 'Account not found', 'USER_NOT_FOUND');
  }

  const resetToken = signPasswordResetToken(user._id.toString(), user.email);
  await PasswordReset.deleteOne({ _id: resetRecord._id });

  return {
    resetToken,
    email: user.email,
    expiresInSeconds: 15 * 60,
  };
}

export async function resetPassword(resetToken: string, password: string) {
  const { verifyPasswordResetToken } = await import('../../shared/utils/jwt');
  const payload = verifyPasswordResetToken(resetToken);
  const user = await User.findById(payload.sub);

  if (!user || user.email !== payload.email) {
    throw new AppError(400, 'Invalid reset token', 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.refreshTokens = [];
  await user.save();

  emitToUser(user._id.toString(), 'auth:password-reset-completed', {
    email: user.email,
  });

  return { message: 'Password reset successfully' };
}

export async function resendPasswordResetCode(email: string) {
  return requestPasswordReset(email);
}

export function getProfilePhotoPublicPath(filename: string): string {
  return `/uploads/profile-photos/${filename}`;
}

export function resolveUploadedPhotoUrl(filename: string): string {
  return `${env.APP_URL}${getProfilePhotoPublicPath(filename)}`;
}

export function resolveAbsolutePhotoPath(filename: string): string {
  return path.join(process.cwd(), env.UPLOAD_DIR, 'profile-photos', filename);
}

export async function updateProfileNames(userId: string, givenName: string, surname: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.givenName = givenName;
  user.surname = surname;
  await user.save();

  emitToUser(userId, 'user:profile-updated', { user: serializeUser(user) });

  return serializeUser(user);
}

export async function setParentalConsent(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.parentalConsent = true;
  user.parentalConsentAt = new Date();
  await user.save();

  emitToUser(userId, 'user:parental-consent-recorded', { user: serializeUser(user) });

  return serializeUser(user);
}

export async function completeRegistration(
  userId: string,
  input: {
    firstName: string;
    lastName: string;
    birthdate: string;
    gender: string;
    termsConsent: true;
    parentalConsent?: boolean;
  },
) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (!user.emailVerified) {
    throw new AppError(403, 'Email verification required', 'EMAIL_NOT_VERIFIED');
  }

  const birthdate = new Date(input.birthdate);
  const age = calculateAge(birthdate);
  const isUnderAge = age < env.MINIMUM_ACCOUNT_AGE;

  if (isUnderAge && !input.parentalConsent && !user.parentalConsent) {
    throw new AppError(403, 'Parental consent is required for users under 16', 'PARENTAL_CONSENT_REQUIRED');
  }

  user.firstName = input.firstName;
  user.lastName = input.lastName;
  user.birthdate = birthdate;
  user.gender = input.gender;
  user.termsConsentAt = new Date();
  user.registrationCompleted = true;
  user.registrationStatus = 'completed';

  if (input.parentalConsent) {
    user.parentalConsent = true;
    user.parentalConsentAt = new Date();
  }

  await user.save();

  emitToUser(userId, 'user:registration-completed', { user: serializeUser(user) });

  return serializeUser(user);
}

export async function getCurrentUser(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return serializeUser(user);
}

export async function updateProfilePhoto(userId: string, filename: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.profilePhotoUrl = resolveUploadedPhotoUrl(filename);
  await user.save();

  return serializeUser(user);
}

type SocialProfileInput = {
  givenName?: string | null;
  surname?: string | null;
  profilePhotoUrl?: string | null;
};

async function findOrCreateSocialUser(input: {
  provider: 'apple' | 'google';
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  profile?: SocialProfileInput;
}) {
  const providerField = input.provider === 'apple' ? 'appleId' : 'googleId';

  let user = await User.findOne({ [providerField]: input.providerId });

  if (user) {
    return user;
  }

  if (input.email) {
    user = await User.findOne({ email: input.email.toLowerCase() });

    if (user) {
      const existingProviderId = user[providerField as 'appleId' | 'googleId'];

      if (existingProviderId && existingProviderId !== input.providerId) {
        throw new AppError(
          409,
          'This email is linked to a different sign-in method',
          'PROVIDER_MISMATCH',
        );
      }

      user[providerField as 'appleId' | 'googleId'] = input.providerId;

      if (input.emailVerified && !user.emailVerified) {
        user.emailVerified = true;
        if (user.registrationStatus === 'pending_email') {
          user.registrationStatus = 'pending_profile';
        }
      }

      if (!user.givenName && input.profile?.givenName) {
        user.givenName = input.profile.givenName;
      }
      if (!user.surname && input.profile?.surname) {
        user.surname = input.profile.surname;
      }
      if (!user.profilePhotoUrl && input.profile?.profilePhotoUrl) {
        user.profilePhotoUrl = input.profile.profilePhotoUrl;
      }

      await user.save();
      return user;
    }
  }

  if (!input.email) {
    throw new AppError(
      400,
      'Email is required for your first Apple sign-in. Try again and share your email.',
      'SOCIAL_EMAIL_REQUIRED',
    );
  }

  return User.create({
    email: input.email.toLowerCase(),
    appleId: input.provider === 'apple' ? input.providerId : undefined,
    googleId: input.provider === 'google' ? input.providerId : undefined,
    accountType: 'individual',
    emailVerified: input.emailVerified,
    registrationStatus: 'pending_profile',
    registrationCompleted: false,
    termsConsentAt: new Date(),
    givenName: input.profile?.givenName ?? undefined,
    surname: input.profile?.surname ?? undefined,
    profilePhotoUrl: input.profile?.profilePhotoUrl ?? undefined,
  });
}

async function completeSocialLogin(user: UserDocument) {
  const { accessToken, refreshToken } = await issueTokens(user);
  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function loginWithApple(input: {
  idToken: string;
  givenName?: string | null;
  surname?: string | null;
}) {
  const identity = await verifyAppleIdentityToken(input.idToken);
  const user = await findOrCreateSocialUser({
    provider: 'apple',
    providerId: identity.providerId,
    email: identity.email,
    emailVerified: identity.emailVerified || Boolean(identity.email),
    profile: {
      givenName: input.givenName,
      surname: input.surname,
    },
  });

  return completeSocialLogin(user);
}

export async function loginWithGoogle(input: { idToken: string }) {
  const identity = await verifyGoogleIdentityToken(input.idToken);
  const user = await findOrCreateSocialUser({
    provider: 'google',
    providerId: identity.providerId,
    email: identity.email,
    emailVerified: identity.emailVerified || Boolean(identity.email),
    profile: {
      givenName: identity.givenName,
      surname: identity.surname,
      profilePhotoUrl: identity.picture,
    },
  });

  return completeSocialLogin(user);
}
