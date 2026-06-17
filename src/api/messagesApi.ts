import { apiRequest } from './client';
import type {
  ConversationsResponse,
  CreateGroupResponse,
  MessagesResponse,
  OpenConversationResponse,
  SendMessageResponse,
} from './types';

export async function fetchConversations(): Promise<ConversationsResponse> {
  return apiRequest<ConversationsResponse>('/messages');
}

export async function fetchUnreadMessageCount(): Promise<{ unreadCount: number }> {
  return apiRequest<{ unreadCount: number }>('/messages/unread-count');
}

export async function openConversationWith(userId: string): Promise<OpenConversationResponse> {
  return apiRequest<OpenConversationResponse>(`/messages/with/${userId}`, {
    method: 'POST',
  });
}

export async function fetchMessages(
  conversationId: string,
  before?: string | null,
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  params.set('limit', '30');
  if (before) {
    params.set('before', before);
  }
  return apiRequest<MessagesResponse>(`/messages/${conversationId}?${params.toString()}`);
}

export async function sendMessage(input: {
  conversationId?: string;
  recipientId?: string;
  text: string;
}): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>('/messages', {
    method: 'POST',
    body: input,
  });
}

export async function sendMediaMessage(input: {
  conversationId?: string;
  recipientId?: string;
  text?: string;
  uri: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
}): Promise<SendMessageResponse> {
  const formData = new FormData();
  const extension = input.mediaType === 'video' ? 'mp4' : 'jpg';
  const mimeType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

  formData.append('file', {
    uri: input.uri,
    name: `message-${Date.now()}.${extension}`,
    type: mimeType,
  } as unknown as Blob);

  formData.append('mediaType', input.mediaType);
  if (input.conversationId) {
    formData.append('conversationId', input.conversationId);
  }
  if (input.recipientId) {
    formData.append('recipientId', input.recipientId);
  }
  if (input.text && input.text.trim()) {
    formData.append('text', input.text.trim());
  }
  if (typeof input.width === 'number') {
    formData.append('width', String(Math.round(input.width)));
  }
  if (typeof input.height === 'number') {
    formData.append('height', String(Math.round(input.height)));
  }

  return apiRequest<SendMessageResponse>('/messages/media', {
    method: 'POST',
    formData,
  });
}

export async function sharePlaceWithContacts(input: {
  placeId: string;
  name: string;
  imageUrl?: string | null;
  recipientIds: string[];
  note?: string;
}): Promise<{ delivered: number; recipientIds: string[] }> {
  return apiRequest<{ delivered: number; recipientIds: string[] }>('/messages/share-place', {
    method: 'POST',
    body: {
      placeId: input.placeId,
      name: input.name,
      imageUrl: input.imageUrl ?? undefined,
      recipientIds: input.recipientIds,
      note: input.note?.trim() ? input.note.trim() : undefined,
    },
  });
}

export async function createGroup(input: {
  name: string;
  memberIds: string[];
}): Promise<CreateGroupResponse> {
  return apiRequest<CreateGroupResponse>('/messages/group', {
    method: 'POST',
    body: input,
  });
}

export async function updateGroupPhoto(
  conversationId: string,
  photoUri: string,
): Promise<{ conversationId: string; avatarUri: string }> {
  const formData = new FormData();
  formData.append('groupPhoto', {
    uri: photoUri,
    name: 'group.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  return apiRequest<{ conversationId: string; avatarUri: string }>(
    `/messages/group/${conversationId}/photo`,
    {
      method: 'POST',
      formData,
    },
  );
}

export async function sharePlaceInConversation(input: {
  conversationId?: string;
  recipientId?: string;
  placeId: string;
  name: string;
  imageUrl?: string | null;
  note?: string;
}): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>('/messages/conversation-place', {
    method: 'POST',
    body: {
      conversationId: input.conversationId,
      recipientId: input.recipientId,
      placeId: input.placeId,
      name: input.name,
      imageUrl: input.imageUrl ?? undefined,
      note: input.note?.trim() ? input.note.trim() : undefined,
    },
  });
}

export async function markConversationRead(
  conversationId: string,
): Promise<{ conversationId: string; unreadCount: number }> {
  return apiRequest<{ conversationId: string; unreadCount: number }>(
    `/messages/${conversationId}/read`,
    { method: 'POST' },
  );
}

export async function blockUser(userId: string): Promise<{ blocked: boolean }> {
  return apiRequest<{ blocked: boolean }>(`/relations/${userId}/block`, { method: 'POST' });
}

export async function unblockUser(userId: string): Promise<{ blocked: boolean }> {
  return apiRequest<{ blocked: boolean }>(`/relations/${userId}/unblock`, { method: 'POST' });
}

export async function restrictUser(userId: string): Promise<{ restricted: boolean }> {
  return apiRequest<{ restricted: boolean }>(`/relations/${userId}/restrict`, { method: 'POST' });
}

export async function unrestrictUser(userId: string): Promise<{ restricted: boolean }> {
  return apiRequest<{ restricted: boolean }>(`/relations/${userId}/unrestrict`, { method: 'POST' });
}
