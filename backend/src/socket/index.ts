import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';

import { env } from '../config/env';
import {
  finalizeCall,
  markCallAnswered,
  notifyCallDismiss,
  recordCallInvite,
  sendIncomingCallPush,
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

// Active (possibly group) voice calls, keyed by callId. The server is the
// source of truth for who is connected and who is still ringing so that mesh
// negotiation, mid-call adds, and reconnects (e.g. after tapping the
// lock-screen incoming-call notification) all stay consistent.
const MAX_CALL_PARTICIPANTS = 4;

type ParticipantInfo = { userId: string; name: string; avatarUri: string | null };

type ActiveCall = {
  callId: string;
  conversationId: string | null;
  hostId: string;
  // Connected (accepted) participants.
  participants: Map<string, ParticipantInfo>;
  // Invited participants whose devices are still ringing.
  invited: Map<string, ParticipantInfo>;
  // The single callee used for the (1:1-shaped) history row of this call.
  recordedCalleeId: string | null;
};

const activeCalls = new Map<string, ActiveCall>();

/** Pushes the current roster to every connected participant for UI updates. */
function emitRoster(call: ActiveCall): void {
  const payload = {
    callId: call.callId,
    participants: [...call.participants.values()],
    invited: [...call.invited.values()],
  };
  for (const pid of call.participants.keys()) {
    io?.to(`user:${pid}`).emit('call:roster', payload);
  }
}

/** Ends a call entirely: notifies everyone, finalizes history, and drops it. */
function teardownCall(call: ActiveCall): void {
  for (const pid of call.participants.keys()) {
    io?.to(`user:${pid}`).emit('call:ended', { callId: call.callId });
  }
  for (const iid of call.invited.keys()) {
    io?.to(`user:${iid}`).emit('call:cancelled', { callId: call.callId });
    void notifyCallDismiss(iid, call.callId);
  }
  activeCalls.delete(call.callId);
  void finalizeCall(call.callId, 'cancelled').then((participants) => {
    if (participants) {
      io?.to(`user:${participants.callerId}`).emit('call:history:updated', {});
      io?.to(`user:${participants.calleeId}`).emit('call:history:updated', {});
    }
  });
}

/** Removes a user from a call (leave/hang-up/disconnect) and ends it if empty. */
function handleLeaveCall(callId: string | undefined, leaverId: string): void {
  if (!callId) {
    return;
  }
  const call = activeCalls.get(callId);
  if (!call) {
    return;
  }
  const wasParticipant = call.participants.delete(leaverId);
  const wasInvited = call.invited.delete(leaverId);
  if (!wasParticipant && !wasInvited) {
    return;
  }

  for (const pid of call.participants.keys()) {
    io?.to(`user:${pid}`).emit('call:peer-left', { callId, peerId: leaverId });
  }

  // No one connected, or a single straggler with nobody else ringing → end.
  if (call.participants.size === 0 || (call.participants.size <= 1 && call.invited.size === 0)) {
    teardownCall(call);
    return;
  }
  emitRoster(call);
}

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

      // If this user is still being rung for an active call, their app likely
      // just reconnected after tapping the incoming-call notification (the
      // socket had dropped in the background). Re-show the incoming call so they
      // can accept and the mesh handshake can complete.
      for (const call of activeCalls.values()) {
        const info = call.invited.get(userId);
        if (info) {
          const host = call.participants.get(call.hostId) ?? {
            userId: call.hostId,
            name: 'Caller',
            avatarUri: null,
          };
          io?.to(`user:${userId}`).emit('call:incoming', {
            callId: call.callId,
            fromUserId: call.hostId,
            conversationId: call.conversationId,
            caller: host,
            roster: [...call.participants.values()],
          });
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

    const selfInfo = (caller?: unknown): ParticipantInfo => {
      const c = caller as Partial<ParticipantInfo> | undefined;
      return {
        userId,
        name: c?.name ?? 'Caller',
        avatarUri: c?.avatarUri ?? null,
      };
    };

    // Host (or any participant) -> server: ring one or more invitees. Used both
    // to start a call and to add people to an ongoing one. The first invite for
    // a callId creates the call and adds the caller as the first participant.
    socket.on(
      'call:invite',
      (payload: {
        callId?: string;
        conversationId?: string | null;
        caller?: ParticipantInfo;
        invitees?: ParticipantInfo[];
      }) => {
        const { callId } = payload;
        if (!callId || !Array.isArray(payload.invitees) || payload.invitees.length === 0) {
          return;
        }

        let call = activeCalls.get(callId);
        const isNew = !call;
        if (!call) {
          call = {
            callId,
            conversationId: payload.conversationId ?? null,
            hostId: userId,
            participants: new Map(),
            invited: new Map(),
            recordedCalleeId: null,
          };
          call.participants.set(userId, selfInfo(payload.caller));
          activeCalls.set(callId, call);
        }

        const host = call.participants.get(call.hostId) ?? selfInfo(payload.caller);

        for (const invitee of payload.invitees) {
          if (!invitee?.userId || invitee.userId === userId) {
            continue;
          }
          if (call.participants.has(invitee.userId) || call.invited.has(invitee.userId)) {
            continue;
          }
          if (call.participants.size + call.invited.size >= MAX_CALL_PARTICIPANTS) {
            break;
          }

          call.invited.set(invitee.userId, {
            userId: invitee.userId,
            name: invitee.name ?? 'Member',
            avatarUri: invitee.avatarUri ?? null,
          });

          io?.to(`user:${invitee.userId}`).emit('call:incoming', {
            callId,
            fromUserId: userId,
            conversationId: call.conversationId,
            caller: host,
            roster: [...call.participants.values()],
          });

          sendIncomingCallPush({
            calleeId: invitee.userId,
            callId,
            callerId: host.userId,
            callerName: host.name,
            callerAvatar: host.avatarUri,
            conversationId: call.conversationId,
          });

          // Record a single representative history row per call (host + first
          // invitee). Group adds don't create additional history rows.
          if (isNew && !call.recordedCalleeId) {
            call.recordedCalleeId = invitee.userId;
            void recordCallInvite({
              callId,
              callerId: userId,
              calleeId: invitee.userId,
              conversationId: call.conversationId,
            });
          }
        }

        emitRoster(call);
      },
    );

    // Invitee -> participants: their device is now ringing ("Ringing…").
    socket.on('call:ringing', (payload: { toUserId?: string; callId?: string }) => {
      relayToUser('call:ringing', payload);
    });

    // Invitee accepts: promote to participant and have existing participants
    // offer to the newcomer (glare-free: older participants offer to newer).
    socket.on('call:accept', (payload: { callId?: string }) => {
      const call = payload.callId ? activeCalls.get(payload.callId) : undefined;
      if (!call) {
        return;
      }
      const info = call.invited.get(userId);
      if (!info) {
        return;
      }
      call.invited.delete(userId);
      call.participants.set(userId, info);

      for (const pid of call.participants.keys()) {
        if (pid !== userId) {
          io?.to(`user:${pid}`).emit('call:peer-joined', { callId: call.callId, peer: info });
        }
      }

      void markCallAnswered(call.callId);
      void notifyCallDismiss(userId, call.callId);
      emitRoster(call);
    });

    const declineInvite = (callId: string | undefined, reason: 'rejected' | 'busy') => {
      const call = callId ? activeCalls.get(callId) : undefined;
      if (!call || !call.invited.delete(userId)) {
        return;
      }
      for (const pid of call.participants.keys()) {
        io?.to(`user:${pid}`).emit('call:peer-declined', { callId: call.callId, peerId: userId, reason });
      }
      if (userId === call.recordedCalleeId) {
        call.recordedCalleeId = null;
        void finalizeCall(call.callId, reason).then(notifyHistoryUpdated);
      }
      if (call.participants.size <= 1 && call.invited.size === 0) {
        teardownCall(call);
        return;
      }
      emitRoster(call);
    };

    socket.on('call:reject', (payload: { callId?: string }) => declineInvite(payload.callId, 'rejected'));
    socket.on('call:busy', (payload: { callId?: string }) => declineInvite(payload.callId, 'busy'));

    // Leave / cancel / hang up — a participant exits; the call ends if empty.
    const onLeave = (payload: { callId?: string }) => handleLeaveCall(payload.callId, userId);
    socket.on('call:leave', onLeave);
    socket.on('call:cancel', onLeave);
    socket.on('call:end', onLeave);

    // WebRTC handshake: SDP offer/answer and ICE candidates (per peer).
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

          // The user's last device went offline — drop them from any calls so
          // peers are notified and empty calls don't leak.
          for (const call of [...activeCalls.values()]) {
            if (call.participants.has(userId) || call.invited.has(userId)) {
              handleLeaveCall(call.callId, userId);
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
