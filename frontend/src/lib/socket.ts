import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

/** One shared connection per browser tab. */
export function getSocket(): Socket {
  socket ??= io(API_URL, { transports: ['websocket'] });
  return socket;
}
