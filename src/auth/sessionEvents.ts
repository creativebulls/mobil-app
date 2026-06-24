/**
 * Lightweight pub/sub for session lifecycle. The API client (and storage layer)
 * emit when the saved session is cleared — e.g. an invalid refresh token or an
 * explicit logout — so a top-level guard can route the user away from
 * authenticated screens instead of leaving them with blank data.
 */
type SessionListener = () => void;

const listeners = new Set<SessionListener>();

/** When set, the next session clear should route to welcome (explicit logout). */
let logoutNavigationPending = false;

export function markNextSessionClearAsLogout(): void {
  logoutNavigationPending = true;
}

export function consumeLogoutNavigation(): boolean {
  const pending = logoutNavigationPending;
  logoutNavigationPending = false;
  return pending;
}

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

/**
 * Emitted when any API call is rejected because the account is suspended, so a
 * top-level guard can route the user to the suspension/appeal screen.
 */
const suspendedListeners = new Set<SessionListener>();

export function onAccountSuspended(listener: SessionListener): () => void {
  suspendedListeners.add(listener);
  return () => {
    suspendedListeners.delete(listener);
  };
}

export function emitAccountSuspended(): void {
  suspendedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A misbehaving listener must not break the others.
    }
  });
}
