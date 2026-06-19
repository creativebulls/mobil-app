import { sendPushToUser } from '../../shared/services/push.service';
import { resolveAbsoluteMediaUrl } from '../../shared/utils/mediaUrl';
import { formatRelativeTime } from '../../shared/utils/time';
import {
  getOrCreateOneToOneConversationId,
  postCallLog,
} from '../messages/messages.service';
import { getUserDisplayName, User } from '../users/user.model';
import { Call, type CallStatus } from './call.model';

const NAME_FIELDS = 'givenName surname firstName lastName email profilePhotoUrl';

const FINAL_STATUSES: CallStatus[] = ['completed', 'missed', 'rejected', 'cancelled'];

export type CallDirection = 'incoming' | 'outgoing';

export type CallHistoryEntry = {
  id: string;
  callId: string;
  peer: { id: string; name: string; avatarUri: string | null };
  conversationId: string | null;
  direction: CallDirection;
  status: CallStatus;
  durationSeconds: number;
  createdAt: string;
  timeAgo: string;
};

type FinalizeReason = 'rejected' | 'cancelled' | 'busy' | 'end';

/**
 * Records a new outgoing call as soon as the caller sends the invite. Idempotent
 * on `callId` so retries/duplicate signaling don't create duplicate rows.
 */
export async function recordCallInvite(input: {
  callId?: string;
  callerId: string;
  calleeId?: string;
  conversationId?: string | null;
}): Promise<void> {
  const { callId, callerId, calleeId, conversationId } = input;
  if (!callId || !calleeId) {
    return;
  }

  if (await Call.exists({ callId })) {
    return;
  }

  const [caller, callee] = await Promise.all([
    User.findById(callerId).select(NAME_FIELDS),
    User.findById(calleeId).select(NAME_FIELDS),
  ]);
  if (!caller || !callee) {
    return;
  }

  const callerName = getUserDisplayName(caller);
  const callerAvatar = caller.profilePhotoUrl ?? null;

  try {
    await Call.create({
      callId,
      caller: callerId,
      callee: calleeId,
      conversationId: conversationId ?? null,
      callerName,
      callerAvatar,
      calleeName: getUserDisplayName(callee),
      calleeAvatar: callee.profilePhotoUrl ?? null,
      status: 'ringing',
      startedAt: new Date(),
    });
  } catch {
    // Unique index race — another signaling event already created the row.
    return;
  }

  // Ring the callee's phone even when the app is backgrounded, closed, or the
  // device is locked. A high-priority push on the high-importance "calls"
  // channel surfaces a heads-up notification with sound/vibration. When the app
  // is in the foreground the client suppresses this and shows the in-app call
  // overlay instead (delivered over the socket).
  void sendPushToUser(calleeId, {
    title: 'Incoming call',
    body: `${callerName} is calling you`,
    imageUrl: resolveAbsoluteMediaUrl(callerAvatar),
    channelId: 'calls',
    androidTag: `incoming-${callId}`,
    // Data-only so the native handler builds a full-screen call notification
    // with a caller avatar, name, and Accept/Reject actions even when locked.
    dataOnly: true,
    data: {
      type: 'incoming_call',
      callId,
      callerId,
      callerName,
      callerAvatar: resolveAbsoluteMediaUrl(callerAvatar) ?? '',
      conversationId: conversationId ?? '',
    },
  }).catch(() => undefined);
}

/** Marks a ringing call as answered when the callee accepts. */
export async function markCallAnswered(callId?: string): Promise<void> {
  if (!callId) {
    return;
  }
  await Call.updateOne(
    { callId, status: 'ringing' },
    { status: 'ongoing', answeredAt: new Date() },
  );
}

/**
 * Tells the callee's device(s) to dismiss the ringing incoming-call
 * notification (once answered, cancelled, rejected, or missed). Delivered as a
 * data-only push so the native handler can cancel the notification.
 */
export async function notifyCallDismiss(userId?: string, callId?: string): Promise<void> {
  if (!userId || !callId) {
    return;
  }
  await sendPushToUser(userId, {
    title: '',
    body: '',
    channelId: 'calls',
    androidTag: `incoming-${callId}`,
    dataOnly: true,
    data: { type: 'call_dismiss', callId },
  }).catch(() => undefined);
}

/**
 * Finalizes a call into a terminal status. Returns the two participant ids so
 * the caller can notify both clients to refresh their history.
 */
export async function finalizeCall(
  callId: string | undefined,
  reason: FinalizeReason,
): Promise<{ callerId: string; calleeId: string } | null> {
  if (!callId) {
    return null;
  }

  const doc = await Call.findOne({ callId });
  if (!doc) {
    return null;
  }

  const participants = { callerId: doc.caller.toString(), calleeId: doc.callee.toString() };

  // Already finalized — nothing to update, but still report participants.
  if (doc.status !== 'ringing' && doc.status !== 'ongoing') {
    return participants;
  }

  const now = new Date();
  let status: CallStatus;
  let durationSeconds = 0;

  if (doc.answeredAt) {
    status = 'completed';
    durationSeconds = Math.max(0, Math.round((now.getTime() - doc.answeredAt.getTime()) / 1000));
  } else if (reason === 'rejected') {
    status = 'rejected';
  } else if (reason === 'cancelled') {
    status = 'cancelled';
  } else {
    // 'busy' or hang-up before the callee answered → a missed call for them.
    status = 'missed';
  }

  doc.status = status;
  doc.endedAt = now;
  doc.durationSeconds = durationSeconds;
  await doc.save();

  // Clear the ringing incoming-call notification on the callee's device once
  // the call is no longer ringing (cancelled/rejected/missed).
  if (status !== 'completed') {
    void notifyCallDismiss(participants.calleeId, doc.callId);
  }

  // Let the callee know they missed a call (incoming call that was never
  // answered), so it surfaces even if their app was backgrounded or closed.
  if (status === 'missed' || status === 'cancelled') {
    void sendPushToUser(participants.calleeId, {
      title: 'Missed call',
      body: `You missed a call from ${doc.callerName}`,
      imageUrl: resolveAbsoluteMediaUrl(doc.callerAvatar ?? null),
      channelId: 'calls',
      androidTag: `call-${doc.callId}`,
      data: {
        type: 'missed_call',
        callId: doc.callId,
        callerId: participants.callerId,
        callerName: doc.callerName,
      },
    }).catch(() => undefined);
  }

  // Drop a WhatsApp-style call log into the conversation thread for both sides.
  void (async () => {
    try {
      const conversationId =
        doc.conversationId?.toString() ??
        (await getOrCreateOneToOneConversationId(participants.callerId, participants.calleeId));
      await postCallLog({
        conversationId,
        callerId: participants.callerId,
        callId: doc.callId,
        status: status as 'completed' | 'missed' | 'rejected' | 'cancelled',
        durationSeconds,
      });
    } catch {
      // Logging a call should never break call finalization.
    }
  })();

  return participants;
}

/** Returns a user's call history, newest first, from their own perspective. */
export async function listCallHistory(userId: string, limit = 50): Promise<CallHistoryEntry[]> {
  const docs = await Call.find({
    $or: [{ caller: userId }, { callee: userId }],
    status: { $in: FINAL_STATUSES },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => {
    const isCaller = doc.caller.toString() === userId;
    return {
      id: doc._id.toString(),
      callId: doc.callId,
      peer: {
        id: (isCaller ? doc.callee : doc.caller).toString(),
        name: isCaller ? doc.calleeName : doc.callerName,
        avatarUri: (isCaller ? doc.calleeAvatar : doc.callerAvatar) ?? null,
      },
      conversationId: doc.conversationId ? doc.conversationId.toString() : null,
      direction: isCaller ? 'outgoing' : 'incoming',
      status: doc.status,
      durationSeconds: doc.durationSeconds ?? 0,
      createdAt: new Date(doc.createdAt).toISOString(),
      timeAgo: formatRelativeTime(new Date(doc.createdAt)),
    };
  });
}
