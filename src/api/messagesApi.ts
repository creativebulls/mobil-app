import { apiRequest } from './client';
import type {
  ConversationsResponse,
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
