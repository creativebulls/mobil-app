import { AppError } from '../../shared/errors/AppError';
import { sendPushToUser } from '../../shared/services/push.service';
import { formatRelativeTime } from '../../shared/utils/time';
import { emitToUser } from '../../socket/index';
import { serializeAuthor, User } from '../users/user.model';
import {
  Notification,
  type NotificationDocument,
  type NotificationType,
} from './notification.model';

type PopulatedActor = {
  _id: { toString(): string };
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profilePhotoUrl?: string;
};

function serializeNotification(notification: NotificationDocument) {
  const actor = notification.actor as unknown as PopulatedActor | null;

  return {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    preview: notification.preview ?? null,
    read: notification.read,
    postId: notification.post ? notification.post.toString() : null,
    actor: actor && actor._id
      ? {
          id: actor._id.toString(),
          name:
            actor.givenName && actor.surname
              ? `${actor.givenName} ${actor.surname}`
              : actor.firstName && actor.lastName
                ? `${actor.firstName} ${actor.lastName}`
                : actor.email.split('@')[0],
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
  };
  const message = messageByType[input.type];

  const notification = await Notification.create({
    recipient: input.recipientId,
    actor: input.actorId,
    type: input.type,
    post: input.postId,
    message,
    preview: input.preview,
  });

  await notification.populate('actor', 'givenName surname firstName lastName email profilePhotoUrl');

  const serialized = serializeNotification(notification);

  emitToUser(input.recipientId, 'notification:new', serialized);

  await sendPushToUser(input.recipientId, {
    title: 'WhereAbout',
    body: input.preview ? `${message}: ${input.preview}` : message,
    data: { type: input.type, postId: input.postId ?? null, notificationId: serialized.id },
  });
}

export async function listNotifications(userId: string, limit = 30, before?: string) {
  const query: Record<string, unknown> = { recipient: userId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'givenName surname firstName lastName email profilePhotoUrl');

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
