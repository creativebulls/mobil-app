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

    // Relay lightweight typing indicators directly to the other participant.
    socket.on('message:typing', (payload: { toUserId?: string; conversationId?: string; typing?: boolean }) => {
      if (!payload?.toUserId) {
        return;
      }
      io?.to(`user:${payload.toUserId}`).emit('message:typing', {
        conversationId: payload.conversationId ?? null,
        userId,
        typing: Boolean(payload.typing),
      });
    });

    // --- Voice call signaling (WebRTC) ---------------------------------------
    // The server is a thin relay: it forwards each signaling message to the
    // target user's room, stamping the authenticated sender id so the recipient
    // always knows who it came from (clients can't spoof `fromUserId`).
    const relayToUser = (event: string, payload: { toUserId?: string } & Record<string, unknown>) => {
      if (!payload?.toUserId) {
        return;
      }
      const { toUserId, ...rest } = payload;
      io?.to(`user:${toUserId}`).emit(event, { ...rest, fromUserId: userId });
    };

    // Caller -> callee: incoming call invitation.
    socket.on('call:invite', (payload: { toUserId?: string; callId?: string; conversationId?: string; caller?: unknown }) => {
      relayToUser('call:incoming', payload);
    });

    // Callee -> caller: accepted / rejected / busy.
    socket.on('call:accept', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:accepted', payload);
    });
    socket.on('call:reject', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:rejected', payload);
    });
    socket.on('call:busy', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:busy', payload);
    });

    // Either party: cancel a ringing call or hang up an active one.
    socket.on('call:cancel', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:cancelled', payload);
    });
    socket.on('call:end', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:ended', payload);
    });

    // WebRTC handshake: SDP offer/answer and ICE candidates.
    socket.on('webrtc:offer', (payload: { toUserId?: string; callId?: string; sdp?: unknown }) => {
      relayToUser('webrtc:offer', payload);
    });
    socket.on('webrtc:answer', (payload: { toUserId?: string; callId?: string; sdp?: unknown }) => {
      relayToUser('webrtc:answer', payload);
    });
    socket.on('webrtc:ice-candidate', (payload: { toUserId?: string; callId?: string; candidate?: unknown }) => {
      relayToUser('webrtc:ice-candidate', payload);
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
