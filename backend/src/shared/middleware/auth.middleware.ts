import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from '../../shared/errors/AppError';
import { verifyAccessToken } from '../../shared/utils/jwt';
import { User, type UserDocument } from '../../modules/users/user.model';

export type AuthenticatedRequest = Request & {
  user?: UserDocument;
  auth?: {
    userId: string;
    email: string;
  };
};

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      throw new AppError(401, 'User not found', 'UNAUTHORIZED');
    }

    req.user = user;
    req.auth = { userId: user._id.toString(), email: user.email };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED');
    }

    throw error;
  }
}

export async function requireVerifiedEmail(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.emailVerified) {
    throw new AppError(403, 'Email verification required', 'EMAIL_NOT_VERIFIED');
  }

  next();
}

/**
 * Blocks suspended accounts from using the app's features. It is intentionally
 * NOT applied to `/auth/me`, logout, or the appeals routes so a suspended user
 * can still see their status and submit an appeal.
 */
export async function requireNotSuspended(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user?.suspended) {
    throw new AppError(
      403,
      req.user.suspensionReason || 'Your account has been suspended.',
      'ACCOUNT_SUSPENDED',
    );
  }

  next();
}
