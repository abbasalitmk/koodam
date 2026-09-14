import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { MessagesService } from '../messages/messages.service';
import { RedisService } from '../../database/redis.service';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  user?: { id: string; role: string };
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly messagesService: MessagesService,
    private readonly redis: RedisService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const rawToken =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '') ??
        client.handshake.query?.token;

      if (!rawToken || typeof rawToken !== 'string') {
        client.disconnect(true);
        return;
      }

      const payload = await this.tokenService.verifyAccessToken(rawToken);
      client.user = { id: payload.sub, role: payload.role };

      // Join user personal notification/event room
      client.join(`user:${payload.sub}`);

      // Update online presence in Redis (TTL 60s)
      await this.redis.client.set(`presence:${payload.sub}`, 'online', 'EX', 60);

      this.logger.debug(`Socket connected for user ${payload.sub}`);
    } catch (err) {
      this.logger.debug(`Socket auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user?.id) {
      await this.redis.client.del(`presence:${client.user.id}`);
      this.logger.debug(`Socket disconnected for user ${client.user.id}`);
    }
  }

  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      client.join(`conversation:${data.conversationId}`);
    }
  }

  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      client.leave(`conversation:${data.conversationId}`);
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      type?: any;
      mediaUrl?: string;
      isIcebreaker?: boolean;
    },
  ) {
    if (!client.user?.id || !data.conversationId || !data.content) return;

    const message = await this.messagesService.sendMessage(client.user.id, data.conversationId, {
      content: data.content,
      type: data.type,
      mediaUrl: data.mediaUrl,
      isIcebreaker: data.isIcebreaker,
    });

    // Broadcast to conversation room
    this.server.to(`conversation:${data.conversationId}`).emit('message:new', message);

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user?.id || !data?.conversationId) return;
    client.to(`conversation:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId: client.user.id,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user?.id || !data?.conversationId) return;
    client.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId: client.user.id,
    });
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user?.id || !data?.conversationId) return;
    await this.messagesService.markAsRead(client.user.id, data.conversationId);
    client.to(`conversation:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      readByUserId: client.user.id,
    });
  }
}
