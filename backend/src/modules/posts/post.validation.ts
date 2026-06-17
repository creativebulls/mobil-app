import { z } from 'zod';

export const createPostSchema = z.object({
  text: z.string().trim().max(2000).optional(),
  placeName: z.string().trim().max(120).optional(),
  placeDistanceKm: z.coerce.number().min(0).max(100000).optional(),
  reaction: z.enum(['like', 'dislike', 'love']).optional(),
});

export const addCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment cannot be empty').max(1000),
  parentId: z.string().optional(),
});

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  before: z.string().datetime().optional(),
});

export const searchPostsQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(1, 'Push token is required'),
});
