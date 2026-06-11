import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';

const accessExpiresIn = env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];
const refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

export type AccessTokenPayload = {
  sub: string;
  email: string;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  type: 'refresh';
  tokenId: string;
};

export type PendingSessionPayload = {
  sub: string;
  email: string;
  type: 'pending';
};

export type PasswordResetPayload = {
  sub: string;
  email: string;
  type: 'password_reset';
};

export type AdminTokenPayload = {
  sub: 'admin';
  email: string;
  type: 'admin';
};

export function signAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { sub: userId, email, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessExpiresIn });
}

export function signRefreshToken(userId: string, tokenId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: 'refresh', tokenId };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: refreshExpiresIn });
}

export function signPendingSessionToken(userId: string, email: string): string {
  const payload: PendingSessionPayload = { sub: userId, email, type: 'pending' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '24h' });
}

export function signPasswordResetToken(userId: string, email: string): string {
  const payload: PasswordResetPayload = { sub: userId, email, type: 'password_reset' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyPendingSessionToken(token: string): PendingSessionPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as PendingSessionPayload;
  if (payload.type !== 'pending') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as PasswordResetPayload;
  if (payload.type !== 'password_reset') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function signAdminToken(email: string): string {
  const payload: AdminTokenPayload = { sub: 'admin', email, type: 'admin' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '8h' });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AdminTokenPayload;
  if (payload.type !== 'admin') {
    throw new Error('Invalid token type');
  }
  return payload;
}
