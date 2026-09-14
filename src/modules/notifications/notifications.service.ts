import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  imageUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async createNotification(params: CreateNotificationParams) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        imageUrl: params.imageUrl,
      },
    });

    // Realtime delivery via WebSockets
    this.realtime.emitToUser(params.userId, 'notification:new', notification);

    // Mock / Firebase push dispatch
    this.dispatchPush(params.userId, params.title, params.body, params.data);

    return notification;
  }

  async list(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async dispatchPush(userId: string, title: string, body: string, data?: any) {
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId, isActive: true },
        select: { token: true, platform: true },
      });

      if (tokens.length > 0) {
        this.logger.debug(
          `Dispatched push to ${tokens.length} devices for user ${userId}: "${title} - ${body}"`,
        );
      }
    } catch (err) {
      this.logger.error(`Push delivery error: ${(err as Error).message}`);
    }
  }
}
