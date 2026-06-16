import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import { env } from '../../config/env';
import { PasswordReset } from '../auth/password-reset.model';
import { Notification } from '../notifications/notification.model';
import {
  PlaceComment,
  PlaceLike,
  PlaceVisit,
} from '../places/place-engagement.model';
import { Comment } from '../posts/comment.model';
import { Post } from '../posts/post.model';
import { User, getUserDisplayName, serializeUser } from '../users/user.model';
import { AppError } from '../../shared/errors/AppError';
import { signAdminToken } from '../../shared/utils/jwt';
import {
  FIREBASE_SERVICE_ACCOUNT_KEY,
  getFirebaseMessaging,
  resetFirebaseMessaging,
} from '../../shared/services/firebase';
import { sendPushToUser } from '../../shared/services/push.service';
import { AppSetting } from './app-setting.model';

const SALT_ROUNDS = 12;

type ServiceAccountFields = {
  type?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export async function getPushConfig() {
  const doc = await AppSetting.findOne({ key: FIREBASE_SERVICE_ACCOUNT_KEY });

  if (!doc?.value) {
    return { configured: false, projectId: null, clientEmail: null, updatedAt: null };
  }

  try {
    const parsed = JSON.parse(doc.value) as ServiceAccountFields;
    return {
      configured: true,
      projectId: parsed.project_id ?? null,
      clientEmail: parsed.client_email ?? null,
      updatedAt: doc.updatedAt,
    };
  } catch {
    return { configured: false, projectId: null, clientEmail: null, updatedAt: doc.updatedAt };
  }
}

export async function setPushConfig(rawServiceAccount: string) {
  let parsed: ServiceAccountFields;

  try {
    const text = rawServiceAccount.trim().startsWith('{')
      ? rawServiceAccount
      : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
    parsed = JSON.parse(text) as ServiceAccountFields;
  } catch {
    throw new AppError(400, 'Service account must be valid JSON', 'INVALID_SERVICE_ACCOUNT');
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new AppError(
      400,
      'Service account JSON is missing required fields (project_id, client_email, private_key)',
      'INVALID_SERVICE_ACCOUNT',
    );
  }

  await AppSetting.findOneAndUpdate(
    { key: FIREBASE_SERVICE_ACCOUNT_KEY },
    { value: JSON.stringify(parsed) },
    { upsert: true, new: true },
  );

  await resetFirebaseMessaging();

  return {
    configured: true,
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
  };
}

export async function clearPushConfig() {
  await AppSetting.deleteOne({ key: FIREBASE_SERVICE_ACCOUNT_KEY });
  await resetFirebaseMessaging();
  return { configured: false };
}

export async function sendTestPush(email: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('expoPushTokens');

  if (!user) {
    throw new AppError(404, 'No user found with that email', 'USER_NOT_FOUND');
  }

  if (user.expoPushTokens.length === 0) {
    throw new AppError(
      422,
      'That user has no registered device. Ask them to open the app once after logging in.',
      'NO_DEVICE_TOKEN',
    );
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    throw new AppError(400, 'Push is not configured yet', 'PUSH_NOT_CONFIGURED');
  }

  await sendPushToUser(user._id.toString(), {
    title: 'WhereAbout test',
    body: 'Push notifications are working.',
    channelId: 'default',
    data: { type: 'test' },
  });

  return { sent: true, deviceCount: user.expoPushTokens.length };
}

export function adminLogin(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  if (
    normalizedEmail !== env.ADMIN_EMAIL.toLowerCase() ||
    password !== env.ADMIN_PASSWORD
  ) {
    throw new AppError(401, 'Invalid admin credentials', 'INVALID_CREDENTIALS');
  }

  return {
    token: signAdminToken(normalizedEmail),
    admin: { email: normalizedEmail },
  };
}

export async function listUsers(input: { search?: string; page: number; limit: number }) {
  const query: Record<string, unknown> = {};

  if (input.search) {
    const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { email: new RegExp(escaped, 'i') },
      { givenName: new RegExp(escaped, 'i') },
      { surname: new RegExp(escaped, 'i') },
      { firstName: new RegExp(escaped, 'i') },
      { lastName: new RegExp(escaped, 'i') },
    ];
  }

  const skip = (input.page - 1) * input.limit;

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((user) => ({
      ...serializeUser(user),
      displayName: getUserDisplayName(user),
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function forceVerifyUser(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;

  if (user.registrationStatus === 'pending_email') {
    user.registrationStatus = 'pending_profile';
  }

  await user.save();

  return {
    user: {
      ...serializeUser(user),
      displayName: getUserDisplayName(user),
    },
    message: 'Email verified successfully',
  };
}

export async function resetUserPassword(userId: string, password: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.refreshTokens = [];
  await user.save();

  await PasswordReset.deleteMany({ email: user.email });

  return {
    userId: user._id.toString(),
    message: 'Password reset successfully. User must sign in again.',
  };
}

export async function deleteUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, 'Invalid user id', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const objectId = user._id;

  await Promise.all([
    Post.deleteMany({ author: objectId }),
    Comment.deleteMany({ author: objectId }),
    Notification.deleteMany({ $or: [{ recipient: objectId }, { actor: objectId }] }),
    PlaceComment.deleteMany({ author: objectId }),
    PlaceLike.deleteMany({ user: objectId }),
    PlaceVisit.deleteMany({ user: objectId }),
    PasswordReset.deleteMany({ email: user.email }),
    Post.updateMany({ likes: objectId }, { $pull: { likes: objectId } }),
    Comment.updateMany({ likes: objectId }, { $pull: { likes: objectId } }),
  ]);

  await user.deleteOne();

  return {
    userId,
    message: 'User and related data deleted',
  };
}
