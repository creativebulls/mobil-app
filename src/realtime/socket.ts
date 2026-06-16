import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { refreshAccessToken } from '../api/client';
import { getSocketUrl } from '../config/api';
import { getSocketToken } from '../storage/authSession';

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
let appStateBound = false;

function bindAppState(): void {
  if (appStateBound) {
    return;
  }
  appStateBound = true;

  // When the app returns to the foreground, the OS may have dropped the socket
  // while suspended. Re-establish the connection so realtime resumes instantly.
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && socket && !socket.connected) {
      socket.connect();
    }
  });
}

async function createConnection(): Promise<Socket | null> {
  const token = await getSocketToken();

  if (!token) {
    return null;
  }

  const socketUrl = await getSocketUrl();

  const instance = io(socketUrl, {
    // Provide the token lazily so every (re)connect attempt uses the freshest
    // token from storage rather than a value captured once at creation time.
    auth: (cb: (data: { token?: string }) => void) => {
      void getSocketToken().then((latest) => cb({ token: latest ?? undefined }));
    },
    // Allow polling fallback so connections still succeed behind proxies/CDNs
    // that don't cleanly upgrade the initial WebSocket handshake.
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  instance.on('connect_error', (error: Error) => {
    // An expired access token fails the handshake. Refresh it; the auth getter
    // above will pick up the new token on the next reconnection attempt.
    if (/auth|token|jwt|unauthor/i.test(error?.message ?? '')) {
      void refreshAccessToken().catch(() => null);
    }
  });

  socket = instance;
  bindAppState();
  return instance;
}

export async function getRealtimeSocket(): Promise<Socket | null> {
  if (socket) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  if (!connecting) {
    connecting = createConnection().finally(() => {
      connecting = null;
    });
  }

  return connecting;
}

export function disconnectRealtimeSocket(): void {
  socket?.disconnect();
  socket = null;
}
