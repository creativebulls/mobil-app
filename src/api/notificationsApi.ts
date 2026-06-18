import { apiRequest } from './client';
import type { NotificationsResponse } from './types';

export async function fetchNotifications(cursor?: string | null): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  params.set('limit', '30');
  if (cursor) {
    params.set('before', cursor);
  }

  return apiRequest<NotificationsResponse>(`/notifications?${params.toString()}`);
}

export async function fetchUnreadCount(): Promise<{ unreadCount: number }> {
  return apiRequest<{ unreadCount: number }>('/notifications/unread-count');
}

export async function markNotificationsRead(ids?: string[]): Promise<{ unreadCount: number }> {
  return apiRequest<{ unreadCount: number }>('/notifications/read', {
    method: 'POST',
    body: ids ? { ids } : {},
  });
}

export async function clearNotifications(): Promise<{ cleared: boolean }> {
  return apiRequest<{ cleared: boolean }>('/notifications', { method: 'DELETE' });
}

export async function registerPushToken(token: string): Promise<{ registered: boolean }> {
  return apiRequest<{ registered: boolean }>('/notifications/push-token', {
    method: 'POST',
    body: { token },
  });
}

export async function removePushToken(token: string): Promise<{ removed: boolean }> {
  return apiRequest<{ removed: boolean }>('/notifications/push-token', {
    method: 'DELETE',
    body: { token },
  });
}
