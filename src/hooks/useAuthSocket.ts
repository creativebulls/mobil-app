import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSocketUrl } from '../config/api';
import type { AuthResponse } from '../api/types';
import { getSocketToken } from '../storage/authSession';

type EmailVerifiedPayload = AuthResponse;

type UseAuthSocketOptions = {
  enabled?: boolean;
  onEmailVerified?: (payload: EmailVerifiedPayload) => void;
};

export function useAuthSocket({ enabled = true, onEmailVerified }: UseAuthSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onEmailVerified);

  useEffect(() => {
    callbackRef.current = onEmailVerified;
  }, [onEmailVerified]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    async function connect() {
      const token = await getSocketToken();

      if (!token || !active) {
        return;
      }

      const socketUrl = await getSocketUrl();

      if (!active) {
        return;
      }

      const socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('auth:email-verified', (payload: EmailVerifiedPayload) => {
        callbackRef.current?.(payload);
      });
    }

    void connect();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  return socketRef;
}
