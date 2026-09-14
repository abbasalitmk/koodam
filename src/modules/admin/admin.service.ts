import { Injectable } from '@nestjs/common';
import { EventStatus, UserStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { users, total, page, limit };
  }

  async updateUserStatus(adminId: string, targetUserId: string, status: UserStatus, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `USER_STATUS_${status}`,
          entity: 'USER',
          entityId: targetUserId,
          metadata: { reason },
        },
      });

      if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) {
        // Invalidate tokens
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.redis.client.set(`auth:revoked:${targetUserId}`, Date.now().toString(), 'EX', 3600);
      }

      return updated;
    });
  }

  async listEvents(status?: EventStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: { select: { id: true, email: true, phone: true } },
          category: true,
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total, page, limit };
  }

  async moderateEvent(adminId: string, eventId: string, status: EventStatus, moderationNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status, moderationNote },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `EVENT_MODERATE_${status}`,
          entity: 'EVENT',
          entityId: eventId,
          metadata: { moderationNote },
        },
      });

      if (status === EventStatus.PUBLISHED) {
        await this.redis.client.geoadd('koodam:events:geo', updated.longitude, updated.latitude, updated.id);
      } else {
        await this.redis.client.zrem('koodam:events:geo', updated.id);
      }

      return updated;
    });
  }

  async listVerificationRequests(status = VerificationStatus.PENDING) {
    return this.prisma.verificationRequest.findMany({
      where: { status },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewVerification(adminId: string, requestId: string, status: VerificationStatus, rejectionReason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedById: adminId,
          reviewedAt: new Date(),
          reviewNote: rejectionReason,
        },
      });

      if (status === VerificationStatus.VERIFIED) {
        await tx.user.update({
          where: { id: req.userId },
          data: { isVerified: true },
        });

        await tx.profile.updateMany({
          where: { userId: req.userId },
          data: { verification: VerificationStatus.VERIFIED },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `VERIFICATION_${status}`,
          entity: 'USER',
          entityId: req.userId,
          metadata: { requestId, rejectionReason },
        },
      });

      return req;
    });
  }

  async listAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, email: true, role: true } },
      },
    });
  }
}
