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
