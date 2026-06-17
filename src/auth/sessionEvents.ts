/**
 * Lightweight pub/sub for session lifecycle. The API client (and storage layer)
 * emit when the saved session is cleared — e.g. an invalid refresh token or an
 * explicit logout — so a top-level guard can route the user back to sign-in
 * instead of leaving them stranded on an authenticated screen with blank data.
 */
type SessionListener = () => void;

const listeners = new Set<SessionListener>();

export function onSessionCleared(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionCleared(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A misbehaving listener must not break the others.
    }
  });
}
