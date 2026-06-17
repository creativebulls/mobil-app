import { AppError } from '../../shared/errors/AppError';
import { sendPushToUser } from '../../shared/services/push.service';
import { resolveAbsoluteMediaUrl } from '../../shared/utils/mediaUrl';
import { formatRelativeTime } from '../../shared/utils/time';
import { emitToUser } from '../../socket/index';
import { DEFAULT_PUSH_PREFERENCES, serializeAuthor, User, type PushPreferences } from '../users/user.model';
import {
  Notification,
  type NotificationDocument,
  type NotificationType,
} from './notification.model';

/** Maps each notification type to the user-facing push preference that controls it. */
const PUSH_CATEGORY_BY_TYPE: Record<NotificationType, keyof PushPreferences> = {
  like: 'likes',
  comment: 'comments',
  reply: 'comments',
  comment_like: 'comments',
  friend_request: 'friendRequests',
  friend_request_accepted: 'friendRequests',
};

type PopulatedActor = {
  _id: { toString(): string };
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profilePhotoUrl?: string;
};

type PopulatedFriendRequest = {
  _id: { toString(): string };
  status?: 'pending' | 'accepted' | 'rejected';
};

function serializeNotification(notification: NotificationDocument) {
  const actor = notification.actor as unknown as PopulatedActor | null;
  const friendRequest = notification.friendRequest as unknown as
    | PopulatedFriendRequest
    | { toString(): string }
    | null;

  const friendRequestStatus =
    friendRequest && typeof friendRequest === 'object' && 'status' in friendRequest
      ? friendRequest.status ?? null
      : null;
  const friendRequestId = friendRequest
    ? (typeof friendRequest === 'object' && '_id' in friendRequest
        ? friendRequest._id.toString()
        : friendRequest.toString())
    : null;

  const actorName =
    actor && actor._id
      ? actor.givenName && actor.surname
        ? `${actor.givenName} ${actor.surname}`
        : actor.firstName && actor.lastName
          ? `${actor.firstName} ${actor.lastName}`
          : actor.email.split('@')[0]
      : 'Someone';

  // For resolved friend requests, show an updated description instead of the
  // original "sent you a friend request" with action buttons.
  let message = notification.message;
  if (notification.type === 'friend_request') {
    if (friendRequestStatus === 'accepted') {
      message = `You and ${actorName} are now friends`;
    } else if (friendRequestStatus === 'rejected') {
      message = `You declined ${actorName}'s friend request`;
    }
  }

  return {
    id: notification._id.toString(),
    type: notification.type,
    message,
    preview: notification.preview ?? null,
    read: notification.read,
    postId: notification.post ? notification.post.toString() : null,
    commentId: notification.comment ? notification.comment.toString() : null,
    friendRequestId,
    friendRequestStatus,
    actor: actor && actor._id
      ? {
          id: actor._id.toString(),
          name: actorName,
          avatarUri: actor.profilePhotoUrl ?? null,
        }
      : null,
    createdAt: notification.createdAt.toISOString(),
    timeAgo: formatRelativeTime(notification.createdAt),
  };
}

export async function createNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  friendRequestId?: string;
  preview?: string;
}): Promise<void> {
  if (input.recipientId === input.actorId) {
    return;
  }

  const actor = await User.findById(input.actorId);

  if (!actor) {
    return;
  }

  const actorSummary = serializeAuthor(actor);
  const messageByType: Record<NotificationType, string> = {
    like: `${actorSummary.name} liked your post`,
    comment: `${actorSummary.name} commented on your post`,
    reply: `${actorSummary.name} replied to your comment`,
    comment_like: `${actorSummary.name} liked your comment`,
    friend_request: `${actorSummary.name} sent you a friend request`,
    friend_request_accepted: `${actorSummary.name} accepted your friend request`,
  };
  const message = messageByType[input.type];

  const notification = await Notification.create({
    recipient: input.recipientId,
    actor: input.actorId,
    type: input.type,
    post: input.postId,
    comment: input.commentId,
    friendRequest: input.friendRequestId,
    message,
    preview: input.preview,
  });

  await notification.populate('actor', 'givenName surname firstName lastName email profilePhotoUrl');
  if (input.friendRequestId) {
    await notification.populate('friendRequest', 'status');
  }

  const serialized = serializeNotification(notification);

  // The in-app notification is always delivered. Push is delivered only if the
  // recipient has push enabled for this category.
  emitToUser(input.recipientId, 'notification:new', serialized);

  const recipient = await User.findById(input.recipientId).select('pushPreferences');
  const preferences: PushPreferences = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...(recipient?.pushPreferences ?? {}),
  };

  if (preferences[PUSH_CATEGORY_BY_TYPE[input.type]]) {
    const pushBody = input.preview ? `${message}: ${input.preview}` : message;
    await sendPushToUser(input.recipientId, {
      title: actorSummary.name,
      body: pushBody.length > 180 ? `${pushBody.slice(0, 180)}…` : pushBody,
      imageUrl: resolveAbsoluteMediaUrl(actor.profilePhotoUrl ?? null),
      subtitle: 'WhereAbout',
      data: {
        type: input.type,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        friendRequestId: input.friendRequestId ?? null,
        notificationId: serialized.id,
        actorId: actorSummary.id,
        actorName: actorSummary.name,
      },
      channelId: 'default',
    });
  }
}

export async function listNotifications(userId: string, limit = 30, before?: string) {
  const query: Record<string, unknown> = { recipient: userId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'givenName surname firstName lastName email profilePhotoUrl')
    .populate('friendRequest', 'status');

  const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipient: userId, read: false });
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<{ unreadCount: number }> {
  const filter: Record<string, unknown> = { recipient: userId, read: false };

  if (ids && ids.length > 0) {
    filter._id = { $in: ids };
  }

  await Notification.updateMany(filter, { $set: { read: true } });

  const unreadCount = await getUnreadCount(userId);
  emitToUser(userId, 'notification:read', { unreadCount });

  return { unreadCount };
}

export async function registerPushToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $addToSet: { expoPushTokens: token } });
}

export async function removePushToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { expoPushTokens: token } });
}

export async function assertNotificationOwner(userId: string, notificationId: string): Promise<void> {
  const notification = await Notification.findById(notificationId);

  if (!notification || notification.recipient.toString() !== userId) {
    throw new AppError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
}
