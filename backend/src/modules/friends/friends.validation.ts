import { z } from 'zod';

export const searchUsersSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export const friendRequestIdSchema = z.object({
  requestId: z.string().min(1),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const updateStatusSchema = z.object({
  statusText: z.string().trim().max(150),
});

export const profilePostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  before: z.string().datetime().optional(),
});
