import { Response } from 'express';

import { requireAuth, requireNotSuspended, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import { z } from 'zod';

import {
  friendRequestIdSchema,
  searchUsersSchema,
  userIdParamSchema,
} from './friends.validation';
import * as friendsService from './friends.service';

export const friendsGuards = [requireAuth, requireVerifiedEmail, requireNotSuspended];

const connectCodeSchema = z.object({ code: z.string().trim().min(1).max(100) });

export const getMyConnectCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await friendsService.getMyConnectCode(req.auth!.userId);
  sendSuccess(res, result);
});

export const resolveConnectCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = connectCodeSchema.parse(req.params);
  const result = await friendsService.resolveConnectCode(req.auth!.userId, params.code);
  sendSuccess(res, result);
});

export const searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = searchUsersSchema.parse(req.query);
  const result = await friendsService.searchUsers(req.auth!.userId, query.q, query.limit);
  sendSuccess(res, result);
});

export const listFriends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await friendsService.listFriends(req.auth!.userId);
  sendSuccess(res, result);
});

export const getMeetPeople = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await friendsService.getMeetPeople(req.auth!.userId);
  sendSuccess(res, result);
});

export const listUserFriends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await friendsService.listFriendsOfUser(req.auth!.userId, params.userId);
  sendSuccess(res, result);
});

export const sendFriendRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = userIdParamSchema.parse(req.params);
  const result = await friendsService.sendFriendRequest(req.auth!.userId, params.userId);
  sendSuccess(res, result, 201);
});

export const acceptFriendRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = friendRequestIdSchema.parse(req.params);
  const result = await friendsService.acceptFriendRequest(req.auth!.userId, params.requestId);
  sendSuccess(res, result);
});

export const rejectFriendRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = friendRequestIdSchema.parse(req.params);
  const result = await friendsService.rejectFriendRequest(req.auth!.userId, params.requestId);
  sendSuccess(res, result);
});
