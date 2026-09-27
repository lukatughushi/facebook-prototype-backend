import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Single shared gateway used by chat messages, notifications and presence.
// Every authenticated client joins a room named "user:<id>" on connect, so
// any service can push a live event to a specific user via emitToUser().
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  // userId -> number of open sockets (a user may have several tabs open).
  private readonly online = new Map<string, number>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token || client.handshake.query?.token) as string;
      if (!token) throw new Error('No token provided');

      const payload = this.jwtService.verify(token);
      const userId = String(payload.id);
      client.data.userId = userId;
      client.join(`user:${userId}`);

      const count = (this.online.get(userId) || 0) + 1;
      this.online.set(userId, count);
      client.emit('presence:init', { online: [...this.online.keys()] });
      if (count === 1) this.server.emit('presence', { userId, online: true });
    } catch {
      this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // socket.io removes the client from its rooms automatically.
    const userId = client.data?.userId;
    if (!userId) return;
    const count = (this.online.get(userId) || 1) - 1;
    if (count > 0) {
      this.online.set(userId, count);
    } else {
      this.online.delete(userId);
      this.server.emit('presence', { userId, online: false });
    }
  }

  // Ids of users with at least one open socket.
  onlineUserIds() {
    return [...this.online.keys()];
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
