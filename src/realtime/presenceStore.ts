type Listener = () => void;

let online = new Set<string>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribePresence(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPresenceSnapshot(): number {
  return online.size;
}

export function isUserOnline(userId: string | null | undefined): boolean {
  return userId ? online.has(userId) : false;
}

export function setPresenceList(userIds: string[]) {
  online = new Set(userIds);
  notify();
}

export function updatePresence(userId: string, isOnline: boolean) {
  if (!userId) {
    return;
  }
  const had = online.has(userId);
  if (isOnline === had) {
    return;
  }
  online = new Set(online);
  if (isOnline) {
    online.add(userId);
  } else {
    online.delete(userId);
  }
  notify();
}

export function seedPresence(userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }
  let changed = false;
  const next = new Set(online);
  for (const id of userIds) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (changed) {
    online = next;
    notify();
  }
}
