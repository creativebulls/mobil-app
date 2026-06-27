import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const pushConfigSchema = z.object({
  serviceAccount: z.string().min(1, 'Service account JSON is required'),
});

export const pushTestSchema = z.object({
  email: z.string().email(),
});

export const placesConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'Foursquare API key is required').max(256),
});

export const googlePlacesConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'Google Places API key is required').max(256),
});

export const googleMapsConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'Google Maps API key is required').max(256),
});

export const placesProviderSchema = z.object({
  provider: z.enum(['foursquare', 'google', 'opentripmap', 'sample']),
});

export const placesCategoriesSchema = z.object({
  keys: z.array(z.string().trim().min(1).max(64)).max(50),
});

export const placesProFieldsSchema = z.object({
  enabled: z.boolean(),
});

export const adminReportsQuerySchema = z.object({
  status: z.enum(['all', 'open', 'reviewed', 'dismissed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminReportStatusSchema = z.object({
  status: z.enum(['open', 'reviewed', 'dismissed']),
});

export const adminSuspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const adminAppealsQuerySchema = z.object({
  status: z.enum(['all', 'pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminAppealReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

export const adminLiveAudioSchema = z.object({
  enabled: z.boolean(),
});

export const appConfigSchema = z.object({
  config: z.record(z.string(), z.string().max(5000)),
});
