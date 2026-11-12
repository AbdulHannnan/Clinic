import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RealtimeEvent } from '@clinic/shared';
import { AuthService } from '../auth/auth.service';

/**
 * Live updates for every screen. Each doctor has two rooms:
 * `public:<doctorId>` for patients (no names) and `staff:<doctorId>` for management and the doctor.
 */
// Origin is resolved per-connection (reads env after ConfigModule has loaded it) and only ever
// matches the configured frontend, so an unset value refuses rather than allowing all origins.
@WebSocketGateway({
  cors: {
    origin: (origin, cb) => cb(null, !!process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL),
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly auth: AuthService) {}

  /** `public:*` is open to patients; `staff:*` requires a valid staff token on the socket handshake. */
  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() room: string) {
    if (/^public:[\w-]+$/.test(room)) {
      socket.join(room);
      return;
    }
    if (!/^staff:[\w-]+$/.test(room)) return;
    const token = socket.handshake.auth?.token ?? (socket.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return;
    // A valid signature isn't enough: confirm the account is still active (deactivated staff are refused).
    const staff = await this.auth.authenticateStaffToken(token);
    if (staff) socket.join(room);
    // Invalid, expired, or deactivated: silently refuse the staff room.
  }

  queueChanged(doctorId: string, publicView: unknown, staffView?: unknown) {
    this.server.to(`public:${doctorId}`).emit(RealtimeEvent.QUEUE_UPDATED, publicView);
    // Push the full staff view when the caller has it, so each staff client renders without a
    // refetch; fall back to a bare nudge only when no payload is supplied.
    this.server.to(`staff:${doctorId}`).emit(RealtimeEvent.QUEUE_UPDATED, staffView ?? { doctorId });
  }
}
