import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

/** One shared connection per browser tab. */
export function getSocket(): Socket {
  socket ??= io(API_URL, { transports: ['websocket'] });
  return socket;
}

/**
 * A dedicated connection for staff screens, carrying the bearer token the gateway checks before it
 * lets a socket into a `staff:<doctorId>` room. Kept separate from the shared public socket and owned
 * by the caller, which disconnects it on unmount or logout.
 */
export function createStaffSocket(token: string): Socket {
  return io(API_URL, { transports: ['websocket'], auth: { token }, forceNew: true });
}
