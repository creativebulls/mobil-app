import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';

import { env, uploadsRoot } from './config/env';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { placesRouter } from './modules/places/places.routes';
import { commentRouter, postRouter } from './modules/posts/post.routes';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware';

export function createApp() {
  const app = express();

  // Behind the Nginx reverse proxy (one hop). Lets express-rate-limit and
  // req.ip / req.protocol read the X-Forwarded-* headers correctly.
  app.set('trust proxy', 1);

  // Serve the static API documentation page at the root. Mounted before helmet
  // so the HTML (which uses inline styles/scripts) is not blocked by the
  // default Content-Security-Policy that helmet applies to the API responses.
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    '/uploads',
    express.static(uploadsRoot, {
      maxAge: env.NODE_ENV === 'production' ? '7d' : 0,
    }),
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'whereabout-backend' } });
  });

  app.use('/api/v1/auth', authLimiter, authRouter);
  app.use('/api/v1/admin', authLimiter, adminRouter);
  app.use('/api/v1/posts', postRouter);
  app.use('/api/v1/comments', commentRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/places', placesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}