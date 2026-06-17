import { env } from '../../config/env';

/**
 * Converts a stored media path (e.g. `/uploads/profile-photos/x.jpg`) or an
 * already-absolute URL into a public HTTPS URL suitable for FCM image payloads.
 */
export function resolveAbsoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${env.APP_URL.replace(/\/$/, '')}${path}`;
}
