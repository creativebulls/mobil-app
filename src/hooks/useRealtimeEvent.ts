import { useEffect, useRef } from 'react';

import { getRealtimeSocket } from '../realtime/socket';

export function useRealtimeEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    async function subscribe() {
      const socket = await getRealtimeSocket();

      if (!socket || !active) {
        return;
      }

      const listener = (payload: T) => handlerRef.current(payload);
      socket.on(event, listener);
      cleanup = () => socket.off(event, listener);
    }

    void subscribe();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [event, enabled]);
}
