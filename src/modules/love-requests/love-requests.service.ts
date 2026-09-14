import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionOrigin, ConnectionStatus, LoveRequestStatus, NotificationType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrivacyService } from '../privacy/privacy.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { calculateAge } from '../../common/utils/date.util';
import { SendLoveRequestDto } from './dto/love-requests.dto';

const LOVE_REQUEST_TTL_HOURS = 48;

@Injectable()
export class LoveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly privacy: PrivacyService,
  ) {}

  async sendLove(senderId: string, dto: SendLoveRequestDto) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException('You cannot send a Love Request to yourself.');
    }

    await this.blocks.assertNotBlocked(senderId, dto.receiverId);

    const receiverPrivacy = await this.privacy.get(dto.receiverId);
    if (!receiverPrivacy.allowLoveRequests) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'This member is not accepting Love Requests at this time',
        403,
      );
    }

    // Check if an active connection already exists
    const [userAId, userBId] = [senderId, dto.receiverId].sort();
    const existingConnection = await this.prisma.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (existingConnection && existingConnection.status === ConnectionStatus.ACTIVE) {
      throw new ConflictException('You are already connected with this member.');
    }

    // Check existing pending request
    const existing = await this.prisma.loveRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId: dto.receiverId } },
    });

    if (existing && existing.status === LoveRequestStatus.PENDING) {
      if (existing.expiresAt.getTime() > Date.now()) {
        throw new ConflictException('You have an active pending Love Request with this member.');
      }
    }

    const expiresAt = new Date(Date.now() + LOVE_REQUEST_TTL_HOURS * 60 * 60 * 1000);

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loveRequest.upsert({
        where: { senderId_receiverId: { senderId, receiverId: dto.receiverId } },
        update: {
          note: dto.note,
          sharedEventId: dto.sharedEventId,
          status: LoveRequestStatus.PENDING,
          expiresAt,
          respondedAt: null,
          createdAt: new Date(),
        },
        create: {
          senderId,
          receiverId: dto.receiverId,
          note: dto.note,
          sharedEventId: dto.sharedEventId,
          status: LoveRequestStatus.PENDING,
          expiresAt,
        },
      });

      // Notification for receiver
      await tx.notification.create({
        data: {
          userId: dto.receiverId,
          type: NotificationType.LOVE_REQUEST,
          title: 'New Love Request 💌',
          body: dto.note
            ? `Someone sent you a Love Request with a note: "${dto.note.slice(0, 50)}..."`
            : 'Someone expressed intentional interest in connecting with you!',
          data: { requestId: created.id, senderId },
        },
      });

      return created;
    });

    return {
      sent: true,
      request,
      expiresInHours: LOVE_REQUEST_TTL_HOURS,
      message: 'Love Request sent! Active for 48 hours for intentional reciprocity.',
    };
  }

  async getReceived(userId: string) {
    // Automatically purge/expire in database query
    const now = new Date();
    const rows = await this.prisma.loveRequest.findMany({
      where: {
        receiverId: userId,
        status: LoveRequestStatus.PENDING,
        expiresAt: { gt: now },
      },
      include: {
        sender: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true, status: 'ACTIVE' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      senderId: r.senderId,
      displayName: r.sender.profile?.displayName ?? 'Koodam member',
      age: r.sender.profile?.dateOfBirth ? calculateAge(r.sender.profile.dateOfBirth) : null,
      city: r.sender.profile?.city,
      homeDistrict: r.sender.profile?.homeDistrict,
      avatarUrl: r.sender.photos[0]?.url ?? null,
      note: r.note,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      hoursRemaining: Math.max(0, Math.round((r.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))),
    }));
  }

  async getSent(userId: string) {
    const rows = await this.prisma.loveRequest.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          include: {
            profile: true,
            photos: { where: { isPrimary: true, status: 'ACTIVE' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      receiverId: r.receiverId,
      displayName: r.receiver.profile?.displayName ?? 'Koodam member',
      avatarUrl: r.receiver.photos[0]?.url ?? null,
      status: r.status,
      note: r.note,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  async accept(receiverId: string, requestId: string) {
    const request = await this.prisma.loveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== receiverId) {
      throw new NotFoundException('Love Request not found.');
    }

    if (request.status !== LoveRequestStatus.PENDING) {
      throw new BadRequestException(`This request is already ${request.status.toLowerCase()}.`);
    }

    if (request.expiresAt.getTime() < Date.now()) {
      await this.prisma.loveRequest.update({
        where: { id: requestId },
        data: { status: LoveRequestStatus.EXPIRED },
      });
      throw new BadRequestException('This 48-hour Love Request has expired.');
    }

    const [userAId, userBId] = [request.senderId, request.receiverId].sort();
    const directKey = `${userAId}:${userBId}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.loveRequest.update({
        where: { id: requestId },
        data: { status: LoveRequestStatus.ACCEPTED, respondedAt: new Date() },
      });

      // Create Connection
      const connection = await tx.connection.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: { status: ConnectionStatus.ACTIVE, origin: ConnectionOrigin.LOVE },
        create: {
          userAId,
          userBId,
          origin: ConnectionOrigin.LOVE,
          status: ConnectionStatus.ACTIVE,
          sharedEventId: request.sharedEventId,
        },
      });

      // Create or reuse direct 1:1 conversation
      const conversation = await tx.conversation.upsert({
        where: { directKey },
        update: {},
        create: {
          type: 'DIRECT',
          directKey,
          members: {
            create: [
              { userId: userAId },
              { userId: userBId },
            ],
          },
        },
      });

      // System icebreaker message
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          content: 'You are now connected via Koodam Love! Say hello with a favourite Sulaimani spot.',
          type: 'SYSTEM',
        },
      });

      // Notify sender
      await tx.notification.create({
        data: {
          userId: request.senderId,
          type: NotificationType.LOVE_ACCEPTED,
          title: 'Love Request Accepted! 💖',
          body: 'Your Love Request was accepted. You can now chat in private messages.',
          data: { conversationId: conversation.id, peerId: receiverId },
        },
      });

      return {
        accepted: true,
        connectionId: connection.id,
        conversationId: conversation.id,
        message: 'Connected! Private chat is now unlocked.',
      };
    });
  }

  async decline(receiverId: string, requestId: string) {
    const request = await this.prisma.loveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.receiverId !== receiverId) {
      throw new NotFoundException('Love Request not found.');
    }

    await this.prisma.loveRequest.update({
      where: { id: requestId },
      data: { status: LoveRequestStatus.DECLINED, respondedAt: new Date() },
    });

    return { declined: true };
  }

  async cancel(senderId: string, requestId: string) {
    const request = await this.prisma.loveRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.senderId !== senderId) {
      throw new NotFoundException('Love Request not found.');
    }

    await this.prisma.loveRequest.update({
      where: { id: requestId },
      data: { status: LoveRequestStatus.CANCELLED },
    });

    return { cancelled: true };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpirationCron() {
    const now = new Date();
    await this.prisma.loveRequest.updateMany({
      where: {
        status: LoveRequestStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: { status: LoveRequestStatus.EXPIRED },
    });
  }
}
