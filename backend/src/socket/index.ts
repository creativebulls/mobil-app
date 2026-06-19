import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';

import { env } from '../config/env';
import {
  finalizeCall,
  markCallAnswered,
  recordCallInvite,
} from '../modules/calls/call-history.service';
import { FriendRequest } from '../modules/friends/friend-request.model';
import { User } from '../modules/users/user.model';
import { sendPushToUser } from '../shared/services/push.service';
import {
  verifyAccessToken,
  verifyAdminToken,
  verifyPendingSessionToken,
  type AccessTokenPayload,
  type AdminTokenPayload,
  type PendingSessionPayload,
} from '../shared/utils/jwt';

let io: Server | null = null;

const pendingSessionRooms = new Map<string, string>();

// Tracks how many active sockets each user has. A user is "online" while the
// count is > 0, which tolerates multiple devices/tabs gracefully.
const onlineCounts = new Map<string, number>();

// In-flight calls that are still ringing, keyed by callId. Lets the server ask
// the caller to re-send the call invite once the callee's app reconnects (e.g.
// after tapping the incoming-call notification from a locked/background state).
const ringingCalls = new Map<string, { callerId: string; calleeId: string }>();

export function isUserOnline(userId: string): boolean {
  return (onlineCounts.get(userId) ?? 0) > 0;
}

/** Number of distinct users with at least one active socket connection. */
export function getOnlineUserCount(): number {
  let count = 0;
  for (const value of onlineCounts.values()) {
    if (value > 0) {
      count += 1;
    }
  }
  return count;
}

async function getFriendIds(userId: string): Promise<string[]> {
  const accepted = await FriendRequest.find({
    status: 'accepted',
    $or: [{ from: userId }, { to: userId }],
  }).select('from to');

  return accepted.map((req) =>
    req.from.toString() === userId ? req.to.toString() : req.from.toString(),
  );
}

async function broadcastPresence(userId: string, online: boolean): Promise<void> {
  const friendIds = await getFriendIds(userId);
  for (const friendId of friendIds) {
    io?.to(`user:${friendId}`).emit('presence:update', { userId, online });
  }
}

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

      let payload: AccessTokenPayload | PendingSessionPayload | AdminTokenPayload;

      try {
        payload = verifyAccessToken(token);
      } catch {
        try {
          payload = verifyPendingSessionToken(token);
        } catch {
          // Admins connect from the web panel with their admin token to drive
          // consent-based live audio sessions.
          payload = verifyAdminToken(token);
        }
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

    // Only real end-user accounts count toward presence; admin/pending sockets
    // join their room for signaling but are never advertised as "online".
    const isFullSession = tokenType === 'access';

    if (tokenType === 'pending') {
      pendingSessionRooms.set(userId, socket.id);
      socket.join(`pending:${userId}`);
    }

    if (isFullSession) {
      const previous = onlineCounts.get(userId) ?? 0;
      onlineCounts.set(userId, previous + 1);
      // Only announce the transition offline -> online to avoid noise from
      // additional devices/reconnects.
      if (previous === 0) {
        void broadcastPresence(userId, true);
      }
      // Send this client the set of friends that are currently online.
      void getFriendIds(userId).then((friendIds) => {
        socket.emit('presence:list', { online: friendIds.filter(isUserOnline) });
      });

      // If this user is the callee of a still-ringing call, their app likely
      // just reconnected after tapping the incoming-call notification (the
      // socket had dropped in the background). Ask the caller to re-send the
      // call so the WebRTC handshake can complete.
      for (const [callId, parties] of ringingCalls) {
        if (parties.calleeId === userId) {
          io?.to(`user:${parties.callerId}`).emit('call:reinvite', { callId, toUserId: userId });
        }
      }
    }

    socket.emit('connection:ready', {
      userId,
      tokenType,
      message: 'Connected to WhereAbout realtime service',
    });

    // A client can ask for the current online set (e.g. after a screen mounts).
    socket.on('presence:request', () => {
      void getFriendIds(userId).then((friendIds) => {
        socket.emit('presence:list', { online: friendIds.filter(isUserOnline) });
      });
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

    // Notifies both participants that a call record changed so any open call
    // history screens can refresh.
    const notifyHistoryUpdated = (participants: { callerId: string; calleeId: string } | null) => {
      if (!participants) {
        return;
      }
      io?.to(`user:${participants.callerId}`).emit('call:history:updated', {});
      io?.to(`user:${participants.calleeId}`).emit('call:history:updated', {});
    };

    // Caller -> callee: incoming call invitation.
    socket.on('call:invite', (payload: { toUserId?: string; callId?: string; conversationId?: string; caller?: unknown }) => {
      relayToUser('call:incoming', payload);
      if (payload.callId && payload.toUserId) {
        ringingCalls.set(payload.callId, { callerId: userId, calleeId: payload.toUserId });
      }
      void recordCallInvite({
        callId: payload.callId,
        callerId: userId,
        calleeId: payload.toUserId,
        conversationId: payload.conversationId ?? null,
      });
    });

    // Caller -> callee: re-delivery of an in-flight call after the callee's app
    // reconnects (so WebRTC can negotiate). Unlike call:invite this does not
    // record a new call or re-send a push — it only re-shows the incoming UI.
    socket.on('call:resend', (payload: { toUserId?: string; callId?: string; caller?: unknown; sdp?: unknown }) => {
      relayToUser('call:incoming', payload);
    });

    // Callee -> caller: the callee's device is now ringing.
    socket.on('call:ringing', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:ringing', payload);
    });

    // Callee -> caller: accepted / rejected / busy.
    socket.on('call:accept', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:accepted', payload);
      if (payload.callId) ringingCalls.delete(payload.callId);
      void markCallAnswered(payload.callId);
    });
    socket.on('call:reject', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:rejected', payload);
      if (payload.callId) ringingCalls.delete(payload.callId);
      void finalizeCall(payload.callId, 'rejected').then(notifyHistoryUpdated);
    });
    socket.on('call:busy', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:busy', payload);
      if (payload.callId) ringingCalls.delete(payload.callId);
      void finalizeCall(payload.callId, 'busy').then(notifyHistoryUpdated);
    });

    // Either party: cancel a ringing call or hang up an active one.
    socket.on('call:cancel', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:cancelled', payload);
      if (payload.callId) ringingCalls.delete(payload.callId);
      void finalizeCall(payload.callId, 'cancelled').then(notifyHistoryUpdated);
    });
    socket.on('call:end', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:ended', payload);
      if (payload.callId) ringingCalls.delete(payload.callId);
      void finalizeCall(payload.callId, 'end').then(notifyHistoryUpdated);
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

    // --- Admin live audio (consent-based) ------------------------------------
    // An admin asks a user to start a live audio session. The user's device
    // shows a consent prompt and only streams microphone audio after they
    // explicitly allow it. The WebRTC handshake reuses the webrtc:* relays
    // above, with the user as the offerer and the admin (`user:admin` room) as
    // the answering listener.
    socket.on('live:request', (payload: { toUserId?: string; sessionId?: string; admin?: unknown }) => {
      // Only authenticated admins may initiate a live request.
      if (tokenType !== 'admin') {
        return;
      }
      if (!payload?.toUserId || !payload.sessionId) {
        return;
      }

      const targetUserId = payload.toUserId;
      const sessionId = payload.sessionId;

      void (async () => {
        // Live audio is opt-in per user: only relay/notify if an admin has
        // explicitly enabled it for this account.
        const target = await User.findById(targetUserId).select('liveAudioEnabled').lean();
        if (!target?.liveAudioEnabled) {
          io?.to(`user:${userId}`).emit('live:rejected', {
            sessionId,
            fromUserId: targetUserId,
            reason: 'not_enabled',
          });
          return;
        }

        relayToUser('live:incoming', payload);

        // Also deliver the consent request as a push so the user can respond
        // even when the app is backgrounded or closed. Tapping it opens the
        // consent prompt in-app for the same session.
        void sendPushToUser(targetUserId, {
          title: 'Information sharing request',
          body: 'An administrator is requesting to start information sharing. Tap to respond.',
          channelId: 'live-audio',
          androidTag: `live:${sessionId}`,
          data: {
            type: 'live_request',
            sessionId,
            adminName: 'Administrator',
          },
        }).catch(() => undefined);
      })();
    });
    socket.on('live:accept', (payload: { toUserId?: string; sessionId?: string }) => {
      relayToUser('live:accepted', payload);
    });
    socket.on('live:reject', (payload: { toUserId?: string; sessionId?: string }) => {
      relayToUser('live:rejected', payload);
    });
    socket.on('live:end', (payload: { toUserId?: string; sessionId?: string }) => {
      relayToUser('live:ended', payload);
    });

    socket.on('disconnect', () => {
      if (pendingSessionRooms.get(userId) === socket.id) {
        pendingSessionRooms.delete(userId);
      }

      if (isFullSession) {
        const previous = onlineCounts.get(userId) ?? 0;
        if (previous <= 1) {
          onlineCounts.delete(userId);
          void broadcastPresence(userId, false);

          // Drop any ringing calls this user initiated so the map can't leak if
          // the caller's app dies before sending an explicit cancel.
          for (const [callId, parties] of ringingCalls) {
            if (parties.callerId === userId) {
              ringingCalls.delete(callId);
            }
          }
        } else {
          onlineCounts.set(userId, previous - 1);
        }
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
