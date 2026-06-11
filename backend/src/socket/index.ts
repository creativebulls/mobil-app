import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';

import { env } from '../config/env';
import {
  verifyAccessToken,
  verifyPendingSessionToken,
  type AccessTokenPayload,
  type PendingSessionPayload,
} from '../shared/utils/jwt';

let io: Server | null = null;

const pendingSessionRooms = new Map<string, string>();

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        next(new Error('Authentication token required'));
        return;
      }

      let payload: AccessTokenPayload | PendingSessionPayload;

      try {
        payload = verifyAccessToken(token);
      } catch {
        payload = verifyPendingSessionToken(token);
      }

      socket.data.userId = payload.sub;
      socket.data.tokenType = payload.type;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new Error('Invalid socket authentication token'));
        return;
      }

      next(error as Error);
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    const tokenType = socket.data.tokenType as string;

    socket.join(`user:${userId}`);

    if (tokenType === 'pending') {
      pendingSessionRooms.set(userId, socket.id);
      socket.join(`pending:${userId}`);
    }

    socket.emit('connection:ready', {
      userId,
      tokenType,
      message: 'Connected to WhereAbout realtime service',
    });

    socket.on('disconnect', () => {
      if (pendingSessionRooms.get(userId) === socket.id) {
        pendingSessionRooms.delete(userId);
      }
    });
  });

  return io;
}

export function getSocketServer(): Server {
  if (!io) {
    throw new Error('Socket server has not been initialized');
  }

  return io;
}

export function emitToUser<T>(userId: string, event: string, payload: T): void {
  if (!io) {
    return;
  }

  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToPendingSession<T>(userId: string, event: string, payload: T): void {
  if (!io) {
    return;
  }

  io.to(`pending:${userId}`).emit(event, payload);
}
