/**
 * Tiny connectivity store. We don't use a native connectivity module; instead
 * the API client reports the outcome of every request here: a completed HTTP
 * response (any status) means we're online, a network-level failure means we're
 * offline. UI subscribes to show an offline banner / empty states.
 */

type Listener = (online: boolean) => void;

let online = true;
const listeners = new Set<Listener>();

export function getIsOnline(): boolean {
  return online;
}

export function setOnline(next: boolean): void {
  if (online === next) {
    return;
  }
  online = next;
  listeners.forEach((listener) => listener(online));
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * True when an error is a network/connectivity failure (vs. a server response).
 * `fetch` and React Native's XHR both throw a `TypeError` when the request never
 * reaches the server.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  const message = (error as { message?: string } | null)?.message?.toLowerCase() ?? '';
  return (
    message.includes('network request failed') ||
    message.includes('network request timed out') ||
    message.includes('failed to fetch') ||
    message.includes('timed out')
  );
}
