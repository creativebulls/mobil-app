import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getRealtimeSocket } from './socket';
import {
  getPresenceSnapshot,
  isUserOnline,
  seedPresence,
  setPresenceList,
  subscribePresence,
  updatePresence,
} from './presenceStore';

type Listener = () => void;

const noopSubscribe = () => () => undefined;

/** Subscribe to online status for one user without re-rendering parent lists. */
export function useIsOnline(userId: string | null | undefined): boolean {
  const subscribe = useCallback(
    (listener: Listener) => (userId ? subscribePresence(listener) : noopSubscribe()),
    [userId],
  );
  const getSnapshot = useCallback(() => isUserOnline(userId), [userId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

type PresenceContextValue = {
  isOnline: (userId: string | null | undefined) => boolean;
  seed: (userIds: string[]) => void;
};

const PresenceContext = createContext<PresenceContextValue>({
  isOnline: isUserOnline,
  seed: seedPresence,
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const requestPresence = useCallback(() => {
    void getRealtimeSocket().then((socket) => socket?.emit('presence:request'));
  }, []);

  useEffect(() => {
    requestPresence();
  }, [requestPresence]);

  useRealtimeEvent('connection:ready', requestPresence);

  useRealtimeEvent<{ online: string[] }>('presence:list', (payload) => {
    setPresenceList(payload.online ?? []);
  });

  useRealtimeEvent<{ userId: string; online: boolean }>('presence:update', (payload) => {
    if (!payload?.userId) {
      return;
    }
    updatePresence(payload.userId, payload.online);
  });

  const value = useMemo<PresenceContextValue>(
    () => ({
      isOnline: isUserOnline,
      seed: seedPresence,
    }),
    [],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}

/** Forces re-render when presence set changes (use sparingly). */
export function usePresenceVersion(): number {
  return useSyncExternalStore(subscribePresence, getPresenceSnapshot, () => 0);
}
