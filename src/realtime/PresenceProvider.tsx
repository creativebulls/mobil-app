import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getRealtimeSocket } from './socket';

type PresenceContextValue = {
  isOnline: (userId: string | null | undefined) => boolean;
  /** Seed the online set from a server response (e.g. friends/conversations list). */
  seed: (userIds: string[]) => void;
};

const PresenceContext = createContext<PresenceContextValue>({
  isOnline: () => false,
  seed: () => undefined,
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<Set<string>>(new Set());

  const requestPresence = useCallback(() => {
    void getRealtimeSocket().then((socket) => socket?.emit('presence:request'));
  }, []);

  useEffect(() => {
    requestPresence();
  }, [requestPresence]);

  // Re-sync whenever the socket (re)connects, since the server pushes the
  // current online set on connect and we may have missed updates while away.
  useRealtimeEvent('connection:ready', requestPresence);

  useRealtimeEvent<{ online: string[] }>('presence:list', (payload) => {
    setOnline(new Set(payload.online ?? []));
  });

  useRealtimeEvent<{ userId: string; online: boolean }>('presence:update', (payload) => {
    if (!payload?.userId) {
      return;
    }
    setOnline((current) => {
      const next = new Set(current);
      if (payload.online) {
        next.add(payload.userId);
      } else {
        next.delete(payload.userId);
      }
      return next;
    });
  });

  const seed = useCallback((userIds: string[]) => {
    if (userIds.length === 0) {
      return;
    }
    setOnline((current) => {
      const next = new Set(current);
      for (const id of userIds) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const value = useMemo<PresenceContextValue>(
    () => ({
      isOnline: (userId) => (userId ? online.has(userId) : false),
      seed,
    }),
    [online, seed],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}
