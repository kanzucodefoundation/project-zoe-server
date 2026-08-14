import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  path: process.env.SOCKET_IO_PATH || '/socket.io',
  cors: {
    origin:
      process.env.FRONTEND_ORIGIN?.split(',').map((o) => o.trim()) ?? false,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<number, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Missing auth token');

      // verifyAsync validates the signature + expiry, unlike decode()
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.id ?? payload.sub;
      const tenantId = payload.tenantId;
      if (!userId) throw new Error('Missing user context');
      if (!tenantId) throw new Error('Missing tenant context');

      client.data.userId = userId;
      client.data.tenantId = tenantId;
      client.join(`tenant:${tenantId}:user:${userId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
    } catch (err) {
      this.logger.warn(
        `Rejecting socket connection: ${
          err instanceof Error ? err.message : err
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const sockets = userId ? this.userSockets.get(userId) : undefined;
    if (!sockets) return;
    sockets.delete(client.id);
    if (sockets.size === 0) this.userSockets.delete(userId);
  }

  // Called by NotificationsService right after a notification is persisted
  emitToUser(tenantId: number, userId: number, payload: unknown) {
    this.server
      .to(`tenant:${tenantId}:user:${userId}`)
      .emit('notification:new', payload);
  }
}
