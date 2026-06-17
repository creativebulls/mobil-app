import { Response } from 'express';

import { requireAuth, requireVerifiedEmail, type AuthenticatedRequest } from '../../shared/middleware/auth.middleware';
import { MAX_POST_IMAGES, postImageUpload } from '../../shared/middleware/upload.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import * as postService from './post.service';
import {
  addCommentSchema,
  createPostSchema,
  feedQuerySchema,
  searchPostsQuerySchema,
} from './post.validation';

export const createPost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createPostSchema.parse({
    text: req.body.text,
    placeName: req.body.placeName,
    placeDistanceKm: req.body.placeDistanceKm,
    reaction: req.body.reaction,
  });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const imageFilenames = files.map((file) => file.filename);

  const result = await postService.createPost({
    authorId: req.auth!.userId,
    text: body.text,
    imageFilenames,
    reaction: body.reaction,
    placeName: body.placeName,
    placeDistanceKm: body.placeDistanceKm,
  });

  sendSuccess(res, result, 201);
});

export const getFeed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = feedQuerySchema.parse(req.query);
  const result = await postService.getFeed(req.auth!.userId, query.limit, query.before);
  sendSuccess(res, result);
});

export const searchPosts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = searchPostsQuerySchema.parse(req.query);
  const result = await postService.searchPosts(req.auth!.userId, query.q, query.limit);
  sendSuccess(res, result);
});

export const getPost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await postService.getPost(req.auth!.userId, String(req.params.id));
  sendSuccess(res, result);
});

export const toggleLike = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await postService.toggleLike(req.auth!.userId, String(req.params.id));
  sendSuccess(res, result);
});

export const listComments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = feedQuerySchema.parse(req.query);
  const result = await postService.listComments(
    req.auth!.userId,
    String(req.params.id),
    query.limit,
    query.before,
  );
  sendSuccess(res, result);
});

export const addComment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = addCommentSchema.parse(req.body);
  const result = await postService.addComment(
    req.auth!.userId,
    String(req.params.id),
    body.text,
    body.parentId,
  );
  sendSuccess(res, result, 201);
});

export const listReplies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = feedQuerySchema.parse(req.query);
  const result = await postService.listReplies(
    req.auth!.userId,
    String(req.params.commentId),
    query.limit,
    query.before,
  );
  sendSuccess(res, result);
});

export const toggleCommentLike = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await postService.toggleCommentLike(req.auth!.userId, String(req.params.commentId));
  sendSuccess(res, result);
});

export const deletePost = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await postService.deletePost(req.auth!.userId, String(req.params.id));
  sendSuccess(res, result);
});

export const createPostMiddleware = postImageUpload.array('images', MAX_POST_IMAGES);
export const postGuards = [requireAuth, requireVerifiedEmail];
