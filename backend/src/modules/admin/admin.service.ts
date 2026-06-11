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

const SALT_ROUNDS = 12;

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
