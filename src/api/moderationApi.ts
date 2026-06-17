import { apiRequest } from './client';
import type { MyAppeal } from './types';

export async function reportUser(input: {
  reportedUserId: string;
  conversationId?: string | null;
  reason: string;
}): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>('/moderation/reports', {
    method: 'POST',
    body: {
      reportedUserId: input.reportedUserId,
      conversationId: input.conversationId ?? undefined,
      reason: input.reason,
    },
  });
}

export async function submitAppeal(message: string): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>('/moderation/appeals', {
    method: 'POST',
    body: { message },
  });
}

export async function fetchMyAppeal(): Promise<{ appeal: MyAppeal | null }> {
  return apiRequest<{ appeal: MyAppeal | null }>('/moderation/appeals/me');
}
