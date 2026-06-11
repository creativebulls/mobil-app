import { Response } from 'express';

import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { feedQuerySchema, markReadSchema, pushTokenSchema } from '../posts/post.validation';
import * as notificationService from './notification.service';

export const listNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = feedQuerySchema.parse(req.query);
  const result = await notificationService.listNotifications(req.auth!.userId, query.limit, query.before);
  sendSuccess(res, result);
});

export const unreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const count = await notificationService.getUnreadCount(req.auth!.userId);
  sendSuccess(res, { unreadCount: count });
});

export const markRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = markReadSchema.parse(req.body ?? {});
  const result = await notificationService.markNotificationsRead(req.auth!.userId, body.ids);
  sendSuccess(res, result);
});

export const registerPushToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = pushTokenSchema.parse(req.body);
  await notificationService.registerPushToken(req.auth!.userId, body.token);
  sendSuccess(res, { registered: true });
});

export const removePushToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = pushTokenSchema.parse(req.body);
  await notificationService.removePushToken(req.auth!.userId, body.token);
  sendSuccess(res, { removed: true });
});

export const notificationGuards = [requireAuth, requireVerifiedEmail];
