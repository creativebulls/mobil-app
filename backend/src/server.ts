import http from 'http';

import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { initializeSocket } from './socket/index';

async function bootstrap() {
  await connectDatabase();

  // Load the admin-managed Foursquare key (if any) before serving requests.
  const { loadPlacesConfig } = await import('./modules/admin/admin.service');
  await loadPlacesConfig();

  const app = createApp();
  const server = http.createServer(app);
  initializeSocket(server);

  // Bind to 0.0.0.0 so physical devices on the LAN can reach the dev server.
  server.listen(env.PORT, '0.0.0.0', () => {
    console.info(`[server] WhereAbout API listening on ${env.APP_URL} (0.0.0.0:${env.PORT})`);
    console.info(`[server] Socket.IO available at ${env.APP_URL}/socket.io`);
  });

  const shutdown = async (signal: string) => {
    console.info(`[server] Received ${signal}, shutting down`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/database');
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[server] Failed to start', error);
  process.exit(1);
});
