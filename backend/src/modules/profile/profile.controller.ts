import { Response } from 'express';

import { z } from 'zod';

import { requireAuth, requireNotSuspended, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import {
  profilePostsQuerySchema,
  updateStatusSchema,
  userIdParamSchema,
} from '../friends/friends.validation';
import { updatePersonalInfoSchema, emailChangeCodeSchema, emailChangeNewEmailSchema, emailChangeConfirmSchema } from './profile.validation';
import * as profileService from './profile.service';
import * as emailChangeService from './email-change.service';

export const profileGuards = [requireAuth, requireVerifiedEmail, requireNotSuspended];

const updateSettingsSchema = z
  .object({
    isPrivate: z.boolean().optional(),
    pushPreferences: z
      .object({
        likes: z.boolean().optional(),
        comments: z.boolean().optional(),
        friendRequests: z.boolean().optional(),
        messages: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => value.isPrivate !== undefined || value.pushPreferences !== undefined, {
    message: 'No settings provided',
  });

export const getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await profileService.getUserSettings(req.auth!.userId);
  sendSuccess(res, result);
});

export const updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updateSettingsSchema.parse(req.body);
  const result = await profileService.updateUserSettings(req.auth!.userId, body);
  sendSuccess(res, result);
});

export const getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await profileService.getProfileStats(req.auth!.userId);
  sendSuccess(res, result);
});

export const updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updateStatusSchema.parse(req.body);
  const result = await profileService.updateStatusText(req.auth!.userId, body.statusText);
  sendSuccess(res, result);
});

export const updatePersonalInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updatePersonalInfoSchema.parse(req.body);
  const result = await profileService.updatePersonalInfo(req.auth!.userId, body);
  sendSuccess(res, result);
});

export const sendCurrentEmailChangeCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await emailChangeService.sendCurrentEmailChangeCode(req.auth!.userId);
  sendSuccess(res, result);
});

export const verifyCurrentEmailChangeCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = emailChangeCodeSchema.parse(req.body);
  const result = await emailChangeService.verifyCurrentEmailChangeCode(req.auth!.userId, body.code);
  sendSuccess(res, result);
});

export const sendNewEmailChangeCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = emailChangeNewEmailSchema.parse(req.body);
  const result = await emailChangeService.sendNewEmailChangeCode(req.auth!.userId, body.newEmail);
  sendSuccess(res, result);
});

export const confirmEmailChange = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = emailChangeConfirmSchema.parse(req.body);
  const result = await emailChangeService.confirmEmailChange(req.auth!.userId, body.newEmail, body.code);
  sendSuccess(res, result);
});

export const listMyPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = profilePostsQuerySchema.parse(req.query);
  const result = await profileService.listUserPosts(
    req.auth!.userId,
    req.auth!.userId,
    query.limit,
    query.before,
  );
  sendSuccess(res, result);
});

export const listFavoritePlaces = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await profileService.listFavoritePlaces(req.auth!.userId);
  sendSuccess(res, result);
});

export const getUserProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await profileService.getPublicUserProfile(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});
