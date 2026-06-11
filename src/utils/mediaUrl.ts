import { resolveBackendHost } from '../config/api';

const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i;

/**
 * Rewrites backend media URLs so they use the same reachable host as API calls.
 * The server often stores `http://localhost:4000/uploads/...` which does not
 * load on a physical device or emulator unless that exact origin is reachable.
 */
export async function resolveMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) {
    return null;
  }

  const host = await resolveBackendHost();

  if (url.startsWith('/')) {
    return `${host}${url}`;
  }

  if (LOCAL_ORIGIN.test(url)) {
    return url.replace(LOCAL_ORIGIN, host);
  }

  return url;
}
