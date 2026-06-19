/**
 * Bus that carries an "answer this call" intent from a notification tap (the
 * native full-screen incoming-call notification's Accept button) to the
 * CallProvider. When the app is cold-started from the notification, the request
 * is buffered until the provider subscribes.
 */

export type CallAcceptIntent = {
  callId: string;
  fromUserId?: string | null;
};

type Listener = (intent: CallAcceptIntent) => void;

const listeners = new Set<Listener>();
let pending: CallAcceptIntent | null = null;

export function onCallAcceptIntent(listener: Listener): () => void {
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

export function emitCallAcceptIntent(intent: CallAcceptIntent): void {
  if (listeners.size === 0) {
    pending = intent;
    return;
  }
  listeners.forEach((listener) => {
    try {
      listener(intent);
    } catch {
      // ignore listener errors
    }
  });
}
