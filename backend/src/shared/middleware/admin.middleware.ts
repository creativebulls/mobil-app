import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from '../../shared/errors/AppError';
import { verifyAdminToken } from '../../shared/utils/jwt';
import type { AuthenticatedRequest } from './auth.middleware';

export type AdminRequest = AuthenticatedRequest & {
  admin?: { email: string };
};

export async function requireAdmin(
  req: AdminRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Admin authentication required', 'UNAUTHORIZED');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAdminToken(token);
    req.admin = { email: payload.email };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'Invalid or expired admin token', 'UNAUTHORIZED');
    }

    throw error;
  }
}
