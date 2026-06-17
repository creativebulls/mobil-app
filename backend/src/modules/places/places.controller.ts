import { Response } from 'express';

import { AppError } from '../../shared/errors/AppError';
import {
  requireAuth,
  requireNotSuspended,
  requireVerifiedEmail,
  type AuthenticatedRequest,
} from '../../shared/middleware/auth.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import * as postService from '../posts/post.service';
import * as engagementService from './place-engagement.service';
import * as placesService from './places.service';
import {
  placeCommentSchema,
  placeCommentsQuerySchema,
  placesQuerySchema,
  placesSearchSchema,
} from './places.validation';

export const getPlaces = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = placesQuerySchema.parse(req.query);
  const result = await placesService.listPlaces(query);
  sendSuccess(res, result);
});

export const searchPlaces = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = placesSearchSchema.parse(req.query);
  const result = await placesService.searchPlaces({
    query: query.q,
    lat: query.lat,
    lon: query.lon,
    limit: query.limit,
  });
  sendSuccess(res, result);
});

export const getPlaceDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const details = await placesService.getPlaceDetails(id);

  if (!details) {
    throw new AppError(404, 'Place not found', 'PLACE_NOT_FOUND');
  }

  sendSuccess(res, details);
});

export const getPlaceEngagement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const [result, details] = await Promise.all([
    engagementService.getPlaceEngagement(id, req.auth!.userId),
    placesService.getPlaceDetails(id),
  ]);

  const postCount = details ? await postService.countPostsByPlace(details.name) : 0;

  sendSuccess(res, { ...result, postCount });
});

export const togglePlaceLike = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const result = await engagementService.togglePlaceLike(id, req.auth!.userId);
  sendSuccess(res, result);
});

export const recordPlaceVisit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const result = await engagementService.recordPlaceVisit(id, req.auth!.userId);
  sendSuccess(res, result);
});

export const listPlaceComments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const query = placeCommentsQuerySchema.parse(req.query);
  const result = await engagementService.listPlaceComments(id, query.limit, query.before);
  sendSuccess(res, result);
});

export const addPlaceComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const body = placeCommentSchema.parse(req.body);
  const result = await engagementService.addPlaceComment(id, req.auth!.userId, body.text);
  sendSuccess(res, result, 201);
});

export const getPlacePosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const query = placeCommentsQuerySchema.parse(req.query);

  const details = await placesService.getPlaceDetails(id);
  if (!details) {
    sendSuccess(res, { posts: [], nextCursor: null });
    return;
  }

  const result = await postService.listPostsByPlace(
    req.auth!.userId,
    details.name,
    query.limit,
    query.before,
  );
  sendSuccess(res, result);
});

export const placesGuards = [requireAuth, requireVerifiedEmail, requireNotSuspended];
