import { Response } from 'express';

import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { z } from 'zod';
import * as relationsService from './relations.service';

const userIdParamSchema = z.object({ userId: z.string().min(1) });

export const relationsGuards = [requireAuth, requireVerifiedEmail];

export const blockUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await relationsService.blockUser(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const unblockUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await relationsService.unblockUser(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const restrictUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await relationsService.restrictUser(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const unrestrictUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await relationsService.unrestrictUser(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const listBlocked = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await relationsService.listBlockedUsers(req.auth!.userId);
  sendSuccess(res, result);
});

export const listRestricted = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await relationsService.listRestrictedUsers(req.auth!.userId);
  sendSuccess(res, result);
});
