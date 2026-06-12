import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { formatRelativeTime } from '../../shared/utils/time';
import { sendPushToUser } from '../../shared/services/push.service';
import { emitToUser } from '../../socket/index';
import { DEFAULT_PUSH_PREFERENCES, getUserDisplayName, User } from '../users/user.model';
import { assertNotBlocked, isBlockedBetween, isRestricted } from '../relations/relations.service';
import { Conversation, type ConversationDocument } from './conversation.model';
import { Message, type MessageDocument } from './message.model';

const PARTICIPANT_FIELDS = 'givenName surname firstName lastName email profilePhotoUrl';

type PopulatedUser = {
  _id: Types.ObjectId;
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profilePhotoUrl?: string;
};

function serializeParticipant(user: PopulatedUser) {
  return {
    id: user._id.toString(),
    name: getUserDisplayName(user),
    avatarUri: user.profilePhotoUrl ?? null,
  };
}

function serializeMessage(message: MessageDocument) {
  return {
    id: message._id.toString(),
    conversationId: message.conversation.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    text: message.text,
    sharedPlace: message.sharedPlace
      ? {
          placeId: message.sharedPlace.placeId,
          name: message.sharedPlace.name,
          imageUrl: message.sharedPlace.imageUrl ?? null,
        }
      : null,
    read: message.read,
    createdAt: message.createdAt.toISOString(),
    timeAgo: formatRelativeTime(message.createdAt),
  };
}

function placePreview(name: string): string {
  return `📍 ${name}`;
}

async function isMessagePushEnabled(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select('pushPreferences');
  return {
    ...DEFAULT_PUSH_PREFERENCES,
    ...(user?.pushPreferences ?? {}),
  }.messages;
}

async function findOrCreateConversation(userA: string, userB: string): Promise<ConversationDocument> {
  const existing = await Conversation.findOne({
    participants: { $all: [userA, userB], $size: 2 },
  });

  if (existing) {
    return existing;
  }

  return Conversation.create({ participants: [userA, userB] });
}

function otherParticipantId(conversation: ConversationDocument, userId: string): string {
  return conversation.participants
    .map((id) => id.toString())
    .find((id) => id !== userId) as string;
}

export async function listConversations(userId: string) {
  const conversations = await Conversation.find({
    participants: userId,
    lastMessageAt: { $exists: true },
  })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate('participants', PARTICIPANT_FIELDS);

  const items = await Promise.all(
    conversations.map(async (conversation) => {
      const other = (conversation.participants as unknown as PopulatedUser[]).find(
        (participant) => participant._id.toString() !== userId,
      );

      const unreadCount = await Message.countDocuments({
        conversation: conversation._id,
        recipient: userId,
        read: false,
      });

      return {
        id: conversation._id.toString(),
        user: other ? serializeParticipant(other) : null,
        lastMessage: conversation.lastMessage ?? null,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        lastMessageMine: conversation.lastMessageSender?.toString() === userId,
        timeAgo: conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : null,
        unreadCount,
      };
    }),
  );

  return { conversations: items };
}

export async function getTotalUnread(userId: string): Promise<number> {
  return Message.countDocuments({ recipient: userId, read: false });
}

export async function getOrCreateConversationWith(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new AppError(422, 'You cannot message yourself', 'INVALID_CONVERSATION');
  }

  const target = await User.findById(targetUserId);
  if (!target || !target.registrationCompleted) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  await assertNotBlocked(userId, targetUserId);

  const conversation = await findOrCreateConversation(userId, targetUserId);

  return {
    id: conversation._id.toString(),
    user: serializeParticipant(target as unknown as PopulatedUser),
  };
}

export async function listMessages(userId: string, conversationId: string, limit = 30, before?: string) {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.participants.some((id) => id.toString() === userId)) {
    throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  const query: Record<string, unknown> = { conversation: conversationId };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit);

  const nextCursor =
    messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  const other = await User.findById(otherParticipantId(conversation, userId)).select(PARTICIPANT_FIELDS);

  return {
    messages: messages.reverse().map(serializeMessage),
    nextCursor,
    user: other ? serializeParticipant(other as unknown as PopulatedUser) : null,
  };
}

export async function sendMessage(senderId: string, conversationId: string | null, recipientId: string | null, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError(422, 'Message cannot be empty', 'EMPTY_MESSAGE');
  }

  let conversation: ConversationDocument | null = null;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some((id) => id.toString() === senderId)) {
      throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    }
  } else if (recipientId) {
    conversation = await findOrCreateConversation(senderId, recipientId);
  } else {
    throw new AppError(422, 'A conversation or recipient is required', 'INVALID_MESSAGE');
  }

  const toUserId = otherParticipantId(conversation, senderId);

  await assertNotBlocked(senderId, toUserId);

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    recipient: toUserId,
    text: trimmed,
  });

  conversation.lastMessage = trimmed;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSender = new Types.ObjectId(senderId);
  await conversation.save();

  const serialized = serializeMessage(message);

  emitToUser(toUserId, 'message:new', serialized);
  emitToUser(senderId, 'message:new', serialized);

  // Restricted senders are delivered silently (no push), Instagram-style.
  const restricted = await isRestricted(toUserId, senderId);
  if (!restricted && (await isMessagePushEnabled(toUserId))) {
    const sender = await User.findById(senderId);
    const senderName = sender ? getUserDisplayName(sender) : 'Someone';
    await sendPushToUser(toUserId, {
      title: senderName,
      body: trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed,
      data: { type: 'message', conversationId: conversation._id.toString() },
      channelId: 'messages',
    });
  }

  return { message: serialized, conversationId: conversation._id.toString() };
}

export async function sharePlaceWithContacts(
  senderId: string,
  place: { placeId: string; name: string; imageUrl?: string | null },
  recipientIds: string[],
  note?: string,
) {
  const trimmedNote = note?.trim() ?? '';
  const sender = await User.findById(senderId);
  const senderName = sender ? getUserDisplayName(sender) : 'Someone';

  const uniqueRecipients = Array.from(new Set(recipientIds)).filter((id) => id && id !== senderId);

  const delivered: string[] = [];

  for (const recipientId of uniqueRecipients) {
    if (await isBlockedBetween(senderId, recipientId)) {
      continue;
    }

    const recipient = await User.findById(recipientId);
    if (!recipient || !recipient.registrationCompleted) {
      continue;
    }

    const conversation = await findOrCreateConversation(senderId, recipientId);

    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      recipient: recipientId,
      text: trimmedNote,
      sharedPlace: {
        placeId: place.placeId,
        name: place.name,
        imageUrl: place.imageUrl ?? undefined,
      },
    });

    conversation.lastMessage = trimmedNote || placePreview(place.name);
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageSender = new Types.ObjectId(senderId);
    await conversation.save();

    const serialized = serializeMessage(message);
    emitToUser(recipientId, 'message:new', serialized);
    emitToUser(senderId, 'message:new', serialized);

    const restricted = await isRestricted(recipientId, senderId);
    if (!restricted && (await isMessagePushEnabled(recipientId))) {
      await sendPushToUser(recipientId, {
        title: senderName,
        body: trimmedNote ? `${trimmedNote} · ${placePreview(place.name)}` : `shared ${placePreview(place.name)}`,
        data: { type: 'message', conversationId: conversation._id.toString() },
        channelId: 'messages',
      });
    }

    delivered.push(recipientId);
  }

  return { delivered: delivered.length, recipientIds: delivered };
}

export async function markConversationRead(userId: string, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.participants.some((id) => id.toString() === userId)) {
    throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  await Message.updateMany(
    { conversation: conversationId, recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );

  const otherUserId = otherParticipantId(conversation, userId);
  emitToUser(otherUserId, 'message:read', { conversationId });

  const unreadCount = await getTotalUnread(userId);
  return { conversationId, unreadCount };
}
