import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUser(userId: string, event: string, payload: any) {
    if (this.gateway.server) {
      this.gateway.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  emitToConversation(conversationId: string, event: string, payload: any) {
    if (this.gateway.server) {
      this.gateway.server.to(`conversation:${conversationId}`).emit(event, payload);
    }
  }
}
