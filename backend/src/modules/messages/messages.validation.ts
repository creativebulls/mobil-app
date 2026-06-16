import { z } from 'zod';

export const conversationIdParamSchema = z.object({
  conversationId: z.string().min(1),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  before: z.string().datetime().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1).optional(),
  recipientId: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(2000),
});

export const sendMediaMessageSchema = z.object({
  conversationId: z.string().min(1).optional(),
  recipientId: z.string().min(1).optional(),
  text: z.string().trim().max(2000).optional(),
  mediaType: z.enum(['image', 'video']),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

export const sharePlaceSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().max(1000).optional(),
  recipientIds: z.array(z.string().min(1)).min(1).max(30),
  note: z.string().trim().max(2000).optional(),
});
