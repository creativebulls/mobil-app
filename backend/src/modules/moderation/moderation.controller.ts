import { Response } from 'express';

import {
  requireAuth,
  requireVerifiedEmail,
  type AuthenticatedRequest,
} from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import * as moderationService from './moderation.service';
import { createAppealSchema, createReportSchema } from './moderation.validation';

// Reports require a verified, active account. Appeals must stay reachable even
// while suspended, so they only require authentication.
export const reportGuards = [requireAuth, requireVerifiedEmail];
export const appealGuards = [requireAuth];

export const createReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createReportSchema.parse(req.body);
  const result = await moderationService.createReport({
    reporterId: req.auth!.userId,
    reportedUserId: body.reportedUserId,
    conversationId: body.conversationId ?? null,
    reason: body.reason,
  });
  sendSuccess(res, result, 201);
});

export const createAppeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createAppealSchema.parse(req.body);
  const result = await moderationService.createAppeal(req.auth!.userId, body.message);
  sendSuccess(res, result, 201);
});

export const getMyAppeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await moderationService.getMyLatestAppeal(req.auth!.userId);
  sendSuccess(res, result);
});
