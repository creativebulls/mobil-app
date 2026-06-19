import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment-specific config first so it takes precedence, then fall back
// to a shared `.env` for any values common to all environments.
//   - development -> .env.development
//   - production  -> .env.production
//   - test        -> .env.test
// Variables already set in the real process environment are never overwritten.
const nodeEnv = process.env.NODE_ENV ?? 'development';
const cwd = process.cwd();

dotenv.config({ path: path.join(cwd, `.env.${nodeEnv}`) });
dotenv.config({ path: path.join(cwd, '.env.local') });
dotenv.config({ path: path.join(cwd, '.env') });

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
  // Places integration (swappable provider: foursquare | opentripmap | sample | google)
  PLACES_PROVIDER: z.enum(['foursquare', 'opentripmap', 'sample', 'google']).default('opentripmap'),
  OPENTRIPMAP_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  // Foursquare Places API (new service-key auth). The key is a "Service Key"
  // from the Foursquare developer console, sent as `Authorization: Bearer`.
  FOURSQUARE_API_KEY: z.string().optional(),
  FOURSQUARE_API_VERSION: z.string().default('2025-06-17'),
  // Photos & ratings are billed "Pro" fields on Foursquare. Leave 'false' on the
  // free tier (no credits); set 'true' once the org has credits to fetch them.
  FOURSQUARE_ENABLE_PRO_FIELDS: z.enum(['true', 'false']).default('false'),
  PLACES_DEFAULT_LAT: z.coerce.number().default(28.6139),
  PLACES_DEFAULT_LON: z.coerce.number().default(77.209),
  PLACES_USER_AGENT: z.string().default('WhereAboutApp/1.0 (support@whereabout.app)'),
  ADMIN_EMAIL: z.string().email().default('admin@whereabout.app'),
  ADMIN_PASSWORD: z.string().min(8).default('admin-change-me'),
  // Firebase Cloud Messaging (push). Provide ONE of the following:
  //   - FIREBASE_SERVICE_ACCOUNT_PATH: absolute path to the service-account JSON on the server
  //   - FIREBASE_SERVICE_ACCOUNT_JSON: the service-account JSON inline (raw or base64-encoded)
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  // WebRTC voice calling. STUN is free/public; TURN is needed for reliable
  // connectivity on cellular/mobile networks (run coturn on the VPS).
  STUN_URLS: z
    .string()
    .default(
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun2.l.google.com:19302',
    ),
  TURN_URLS: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDevelopment = env.NODE_ENV === 'development';

// Absolute root for uploaded media, shared by the static file server and the
// Multer storage engines. Supports an absolute UPLOAD_DIR (e.g. a persistent
// disk mount in production) and falls back to a path relative to the process
// working directory. Resolving it once here keeps the served path and the
// written path in sync regardless of where the process is started from.
export const uploadsRoot = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);
