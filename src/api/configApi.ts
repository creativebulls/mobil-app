import { apiRequest } from './client';

/**
 * Fetches the admin-managed app config (text, button labels, link URLs). This
 * is a public endpoint, so it works before the user signs in.
 */
export async function fetchAppConfig(): Promise<Record<string, string>> {
  const data = await apiRequest<{ config: Record<string, string> }>('/app-config', {
    skipAuthRefresh: true,
  });
  return data.config ?? {};
}
