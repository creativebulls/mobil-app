import { apiRequest } from './client';

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export async function fetchIceServers(): Promise<IceServer[]> {
  const result = await apiRequest<{ iceServers: IceServer[] }>('/calls/ice-servers');
  return result.iceServers ?? [];
}

export type CallDirection = 'incoming' | 'outgoing';

export type CallHistoryStatus = 'completed' | 'missed' | 'rejected' | 'cancelled';

export type CallHistoryEntry = {
  id: string;
  callId: string;
  peer: { id: string; name: string; avatarUri: string | null };
  conversationId: string | null;
  direction: CallDirection;
  status: CallHistoryStatus;
  durationSeconds: number;
  createdAt: string;
  timeAgo: string;
};

export async function fetchCallHistory(limit = 50): Promise<CallHistoryEntry[]> {
  const result = await apiRequest<{ entries: CallHistoryEntry[] }>(`/calls/history?limit=${limit}`);
  return result.entries ?? [];
}
