import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RealtimeEvent } from '@clinic/shared';

/**
 * Live updates for every screen. Each doctor has two rooms:
 * `public:<doctorId>` for patients (no names) and `staff:<doctorId>` for management and the doctor.
 */
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  // TODO(auth): only staff tokens may join staff rooms.
  @SubscribeMessage('join')
  join(@ConnectedSocket() socket: Socket, @MessageBody() room: string) {
    if (/^(public|staff):[\w-]+$/.test(room)) socket.join(room);
  }

  queueChanged(doctorId: string, publicView: unknown) {
    this.server.to(`public:${doctorId}`).emit(RealtimeEvent.QUEUE_UPDATED, publicView);
    this.server.to(`staff:${doctorId}`).emit(RealtimeEvent.QUEUE_UPDATED, { doctorId });
  }
}
