import { io, type Socket } from 'socket.io-client';

import { getSocketUrl } from '../config/api';
import { getSocketToken } from '../storage/authSession';

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

async function createConnection(): Promise<Socket | null> {
  const token = await getSocketToken();

  if (!token) {
    return null;
  }

  const socketUrl = await getSocketUrl();

  const instance = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
  });

  socket = instance;
  return instance;
}

export async function getRealtimeSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
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
