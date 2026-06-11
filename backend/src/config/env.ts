import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('365d'),
  APP_URL: z.string().url(),
  MOBILE_DEEP_LINK_SCHEME: z.string().default('mobileapp'),
  CORS_ORIGIN: z.string().default('*'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('WhereAbout <noreply@whereabout.app>'),
  UPLOAD_DIR: z.string().default('uploads'),
  MINIMUM_ACCOUNT_AGE: z.coerce.number().default(16),
  // Places integration (swappable provider: opentripmap | sample | google)
  PLACES_PROVIDER: z.enum(['opentripmap', 'sample', 'google']).default('opentripmap'),
  OPENTRIPMAP_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  PLACES_DEFAULT_LAT: z.coerce.number().default(28.6139),
  PLACES_DEFAULT_LON: z.coerce.number().default(77.209),
  PLACES_USER_AGENT: z.string().default('WhereAboutApp/1.0 (support@whereabout.app)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDevelopment = env.NODE_ENV === 'development';
