import { z } from 'zod';

export const placesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  offset: z.coerce.number().int().min(0).max(500).optional(),
});

export const placesSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  offset: z.coerce.number().int().min(0).max(500).optional(),
});

export const placeCommentSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

export const placeCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
});
