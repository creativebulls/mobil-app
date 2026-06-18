/**
 * Lightweight bus that lets a push-notification tap hand a pending live audio
 * request to the LiveAudioProvider. Used when the socket missed the original
 * `live:incoming` event because the app was backgrounded or closed.
 */

export type LiveRequest = {
  sessionId: string;
  adminName?: string | null;
};

type Listener = (request: LiveRequest) => void;

const listeners = new Set<Listener>();
// Buffers a request that arrives before the provider has subscribed (e.g. the
// app is cold-started from a notification tap).
let pending: LiveRequest | null = null;

export function onLiveRequest(listener: Listener): () => void {
  listeners.add(listener);
  if (pending) {
    const buffered = pending;
    pending = null;
    listener(buffered);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function emitLiveRequest(request: LiveRequest): void {
  if (listeners.size === 0) {
    pending = request;
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener(request);
    } catch {
      // ignore listener errors
    }
  });
}
