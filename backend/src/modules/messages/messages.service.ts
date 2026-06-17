import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { formatRelativeTime } from '../../shared/utils/time';
import { sendPushToUser } from '../../shared/services/push.service';
import { resolveAbsoluteMediaUrl } from '../../shared/utils/mediaUrl';
import { emitToUser, isUserOnline } from '../../socket/index';
import { DEFAULT_PUSH_PREFERENCES, getUserDisplayName, User } from '../users/user.model';
import { assertNotBlocked, isBlockedBetween, isRestricted } from '../relations/relations.service';
import { Conversation, type ConversationDocument } from './conversation.model';
import { Message, type MessageDocument, type MessageMediaType } from './message.model';

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

function isPopulatedUser(value: unknown): value is PopulatedUser {
  return typeof value === 'object' && value !== null && '_id' in value;
}

function serializeMessage(message: MessageDocument) {
  const senderRaw = message.sender as unknown;
  const senderPopulated = isPopulatedUser(senderRaw);
  const senderId = senderPopulated ? senderRaw._id.toString() : (senderRaw as Types.ObjectId).toString();

  return {
    id: message._id.toString(),
    conversationId: message.conversation.toString(),
    senderId,
    senderName: senderPopulated ? getUserDisplayName(senderRaw) : null,
    senderAvatar: senderPopulated ? senderRaw.profilePhotoUrl ?? null : null,
    recipientId: message.recipient ? message.recipient.toString() : null,
    text: message.text,
    sharedPlace: message.sharedPlace
      ? {
          placeId: message.sharedPlace.placeId,
          name: message.sharedPlace.name,
          imageUrl: message.sharedPlace.imageUrl ?? null,
        }
      : null,
    media: message.media
      ? {
          url: message.media.url,
          mediaType: message.media.mediaType,
          width: message.media.width ?? null,
          height: message.media.height ?? null,
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

function resolveMessageMediaUrl(filename: string): string {
  return `/uploads/messages/${filename}`;
}

function resolveGroupPhotoUrl(filename: string): string {
  return `/uploads/group-photos/${filename}`;
}

function mediaPreview(type: MessageMediaType): string {
  return type === 'video' ? '🎥 Video' : '📷 Photo';
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
    isGroup: { $ne: true },
  });

  if (existing) {
    return existing;
  }

  return Conversation.create({ participants: [userA, userB], isGroup: false });
}

function otherParticipantId(conversation: ConversationDocument, userId: string): string {
  return conversation.participants
    .map((id) => id.toString())
    .find((id) => id !== userId) as string;
}

async function resolveConversation(
  senderId: string,
  conversationId: string | null,
  recipientId: string | null,
): Promise<ConversationDocument> {
  if (conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some((id) => id.toString() === senderId)) {
      throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
    }
    return conversation;
  }

  if (recipientId) {
    return findOrCreateConversation(senderId, recipientId);
  }

  throw new AppError(422, 'A conversation or recipient is required', 'INVALID_MESSAGE');
}

/**
 * Persists a message, updates conversation metadata, emits the realtime event
 * to every participant, and pushes notifications. Works for both 1:1 chats
 * (single recipient + read flag) and group chats (no recipient, readBy array).
 */
async function deliverToConversation(
  conversation: ConversationDocument,
  senderId: string,
  fields: {
    text?: string;
    media?: { url: string; mediaType: MessageMediaType; width?: number; height?: number };
    sharedPlace?: { placeId: string; name: string; imageUrl?: string };
    preview: string;
  },
) {
  const participantIds = conversation.participants.map((id) => id.toString());
  const others = participantIds.filter((id) => id !== senderId);
  const recipientId = conversation.isGroup ? undefined : others[0];

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    recipient: recipientId,
    readBy: [senderId],
    text: fields.text?.trim() ?? '',
    media: fields.media,
    sharedPlace: fields.sharedPlace,
  });

  conversation.lastMessage = fields.preview;
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSender = new Types.ObjectId(senderId);
  await conversation.save();

  await message.populate('sender', PARTICIPANT_FIELDS);
  const serialized = serializeMessage(message);

  emitToUser(senderId, 'message:new', serialized);
  for (const other of others) {
    emitToUser(other, 'message:new', serialized);
  }

  const senderName = serialized.senderName ?? 'Someone';
  const title = conversation.isGroup ? conversation.name ?? 'Group chat' : senderName;
  const body = conversation.isGroup ? `${senderName}: ${fields.preview}` : fields.preview;

  for (const other of others) {
    if (await isBlockedBetween(senderId, other)) {
      continue;
    }
    if (await isRestricted(other, senderId)) {
      continue;
    }
    if (!(await isMessagePushEnabled(other))) {
      continue;
    }
    await sendPushToUser(other, {
      title,
      body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      imageUrl: resolveAbsoluteMediaUrl(serialized.senderAvatar),
      subtitle: conversation.isGroup ? senderName : null,
      data: {
        type: 'message',
        conversationId: conversation._id.toString(),
        senderId,
        senderName,
        isGroup: conversation.isGroup ? '1' : '0',
      },
      channelId: 'messages',
      androidTag: `chat-${conversation._id.toString()}`,
    });
  }

  return { message: serialized, conversationId: conversation._id.toString() };
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
      const participants = conversation.participants as unknown as PopulatedUser[];
      const lastMessageMine = conversation.lastMessageSender?.toString() === userId;
      const timeAgo = conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : null;

      if (conversation.isGroup) {
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });

        return {
          id: conversation._id.toString(),
          isGroup: true,
          name: conversation.name ?? 'Group chat',
          avatarUri: conversation.avatarUrl ?? null,
          memberCount: participants.length,
          isOnline: false,
          user: null,
          lastMessage: conversation.lastMessage ?? null,
          lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
          lastMessageMine,
          timeAgo,
          unreadCount,
        };
      }

      const other = participants.find((participant) => participant._id.toString() !== userId);
      const unreadCount = await Message.countDocuments({
        conversation: conversation._id,
        recipient: userId,
        read: false,
      });

      return {
        id: conversation._id.toString(),
        isGroup: false,
        name: other ? getUserDisplayName(other) : 'Unknown',
        avatarUri: other?.profilePhotoUrl ?? null,
        memberCount: 2,
        isOnline: other ? isUserOnline(other._id.toString()) : false,
        user: other ? serializeParticipant(other) : null,
        lastMessage: conversation.lastMessage ?? null,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        lastMessageMine,
        timeAgo,
        unreadCount,
      };
    }),
  );

  return { conversations: items };
}

export async function getTotalUnread(userId: string): Promise<number> {
  const oneToOne = await Message.countDocuments({ recipient: userId, read: false });

  const groupConversations = await Conversation.find({
    participants: userId,
    isGroup: true,
  }).select('_id');

  if (groupConversations.length === 0) {
    return oneToOne;
  }

  const groupUnread = await Message.countDocuments({
    conversation: { $in: groupConversations.map((conversation) => conversation._id) },
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });

  return oneToOne + groupUnread;
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

export async function createGroup(ownerId: string, name: string, memberIds: string[]) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError(422, 'Group name is required', 'GROUP_NAME_REQUIRED');
  }

  const unique = Array.from(new Set(memberIds)).filter((id) => id && id !== ownerId);
  if (unique.length === 0) {
    throw new AppError(422, 'Select at least one member', 'GROUP_MEMBERS_REQUIRED');
  }

  const validMembers: string[] = [];
  for (const memberId of unique) {
    if (await isBlockedBetween(ownerId, memberId)) {
      continue;
    }
    const member = await User.findById(memberId);
    if (member && member.registrationCompleted) {
      validMembers.push(memberId);
    }
  }

  if (validMembers.length === 0) {
    throw new AppError(422, 'No valid members selected', 'GROUP_MEMBERS_INVALID');
  }

  const participants = [ownerId, ...validMembers];
  const now = new Date();

  const conversation = await Conversation.create({
    participants,
    isGroup: true,
    name: trimmedName,
    owner: ownerId,
    lastMessage: 'Group created',
    lastMessageAt: now,
    lastMessageSender: new Types.ObjectId(ownerId),
  });

  for (const participantId of participants) {
    emitToUser(participantId, 'conversation:new', {
      conversationId: conversation._id.toString(),
    });
  }

  return {
    id: conversation._id.toString(),
    name: trimmedName,
    memberCount: participants.length,
    avatarUri: conversation.avatarUrl ?? null,
  };
}

export async function updateGroupPhoto(userId: string, conversationId: string, filename: string) {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.isGroup) {
    throw new AppError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }

  if (!conversation.participants.some((id) => id.toString() === userId)) {
    throw new AppError(404, 'Group not found', 'GROUP_NOT_FOUND');
  }

  if (conversation.owner?.toString() !== userId) {
    throw new AppError(403, 'Only the group owner can change the photo', 'GROUP_PHOTO_FORBIDDEN');
  }

  conversation.avatarUrl = resolveGroupPhotoUrl(filename);
  await conversation.save();

  for (const participantId of conversation.participants.map((id) => id.toString())) {
    emitToUser(participantId, 'conversation:updated', {
      conversationId: conversation._id.toString(),
    });
  }

  return {
    conversationId: conversation._id.toString(),
    avatarUri: conversation.avatarUrl,
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

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', PARTICIPANT_FIELDS);

  const nextCursor =
    messages.length === limit ? messages[messages.length - 1].createdAt.toISOString() : null;

  const participantDocs = await User.find({ _id: { $in: conversation.participants } }).select(
    PARTICIPANT_FIELDS,
  );
  const participants = participantDocs.map((doc) => serializeParticipant(doc as unknown as PopulatedUser));

  const other = conversation.isGroup
    ? null
    : participants.find((participant) => participant.id !== userId) ?? null;

  return {
    messages: messages.reverse().map(serializeMessage),
    nextCursor,
    user: other,
    conversation: {
      id: conversation._id.toString(),
      isGroup: conversation.isGroup,
      name: conversation.name ?? null,
      avatarUri: conversation.avatarUrl ?? null,
      ownerId: conversation.owner?.toString() ?? null,
      memberCount: participants.length,
      participants,
    },
  };
}

export async function sendMessage(
  senderId: string,
  conversationId: string | null,
  recipientId: string | null,
  text: string,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError(422, 'Message cannot be empty', 'EMPTY_MESSAGE');
  }

  const conversation = await resolveConversation(senderId, conversationId, recipientId);

  if (!conversation.isGroup) {
    await assertNotBlocked(senderId, otherParticipantId(conversation, senderId));
  }

  return deliverToConversation(conversation, senderId, { text: trimmed, preview: trimmed });
}

export async function sendMediaMessage(
  senderId: string,
  conversationId: string | null,
  recipientId: string | null,
  media: { filename: string; mediaType: MessageMediaType; width?: number; height?: number },
  text: string,
) {
  const trimmed = text.trim();

  const conversation = await resolveConversation(senderId, conversationId, recipientId);

  if (!conversation.isGroup) {
    await assertNotBlocked(senderId, otherParticipantId(conversation, senderId));
  }

  const preview = trimmed
    ? `${mediaPreview(media.mediaType)} ${trimmed}`
    : mediaPreview(media.mediaType);

  return deliverToConversation(conversation, senderId, {
    text: trimmed,
    media: {
      url: resolveMessageMediaUrl(media.filename),
      mediaType: media.mediaType,
      width: media.width,
      height: media.height,
    },
    preview,
  });
}

/** Share a place into an existing (1:1 or group) conversation. */
export async function sharePlaceInConversation(
  senderId: string,
  target: { conversationId?: string | null; recipientId?: string | null },
  place: { placeId: string; name: string; imageUrl?: string | null },
  note?: string,
) {
  const conversation = await resolveConversation(
    senderId,
    target.conversationId ?? null,
    target.recipientId ?? null,
  );

  if (!conversation.isGroup) {
    await assertNotBlocked(senderId, otherParticipantId(conversation, senderId));
  }

  const trimmedNote = note?.trim() ?? '';
  const preview = trimmedNote ? `${trimmedNote} · ${placePreview(place.name)}` : placePreview(place.name);

  return deliverToConversation(conversation, senderId, {
    text: trimmedNote,
    sharedPlace: {
      placeId: place.placeId,
      name: place.name,
      imageUrl: place.imageUrl ?? undefined,
    },
    preview,
  });
}

export async function sharePlaceWithContacts(
  senderId: string,
  place: { placeId: string; name: string; imageUrl?: string | null },
  recipientIds: string[],
  note?: string,
) {
  const trimmedNote = note?.trim() ?? '';
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
    await deliverToConversation(conversation, senderId, {
      text: trimmedNote,
      sharedPlace: {
        placeId: place.placeId,
        name: place.name,
        imageUrl: place.imageUrl ?? undefined,
      },
      preview: trimmedNote ? `${trimmedNote} · ${placePreview(place.name)}` : placePreview(place.name),
    });

    delivered.push(recipientId);
  }

  return { delivered: delivered.length, recipientIds: delivered };
}

export async function markConversationRead(userId: string, conversationId: string) {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.participants.some((id) => id.toString() === userId)) {
    throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND');
  }

  if (conversation.isGroup) {
    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    );
  } else {
    await Message.updateMany(
      { conversation: conversationId, recipient: userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );

    const otherUserId = otherParticipantId(conversation, userId);
    emitToUser(otherUserId, 'message:read', { conversationId });
  }

  const unreadCount = await getTotalUnread(userId);
  return { conversationId, unreadCount };
}
