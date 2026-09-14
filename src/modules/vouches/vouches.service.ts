import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { SubmitVouchDto, VouchByTokenDto } from './dto/vouches.dto';

@Injectable()
export class VouchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async submitVouch(voucherId: string, dto: SubmitVouchDto) {
    return this.executeVouch(dto.eventId, voucherId, dto.note);
  }

  async submitVouchByToken(voucherId: string, dto: VouchByTokenDto) {
    const event = await this.prisma.event.findUnique({
      where: { vouchToken: dto.vouchToken },
      select: { id: true },
    });
    if (!event) throw AppException.notFound('Vouch token is invalid or has expired');
    return this.executeVouch(event.id, voucherId, dto.note);
  }

  async getVouchTokenPreview(vouchToken: string) {
    const event = await this.prisma.event.findUnique({
      where: { vouchToken, deletedAt: null },
      include: {
        category: true,
        organizer: {
          select: {
            id: true,
            isVerified: true,
            profile: { select: { displayName: true, peerVouchScore: true } },
            photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
        vouches: {
          include: {
            voucher: {
              select: {
                id: true,
                isVerified: true,
                profile: { select: { displayName: true } },
                photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found or link expired');
    return event;
  }

  async listVouchesForEvent(eventId: string) {
    return this.prisma.eventVouch.findMany({
      where: { eventId },
      include: {
        voucher: {
          select: {
            id: true,
            isVerified: true,
            profile: { select: { displayName: true, peerVouchScore: true } },
            photos: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async executeVouch(eventId: string, voucherId: string, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');

      if (event.organizerId === voucherId) {
        throw new BadRequestException('Hosts cannot vouch for their own gathering.');
      }

      const existingVouch = await tx.eventVouch.findUnique({
        where: { eventId_voucherId: { eventId, voucherId } },
      });
      if (existingVouch) {
        throw new BadRequestException('You have already vouched for this gathering.');
      }

      await tx.eventVouch.create({
        data: {
          eventId,
          voucherId,
          note,
        },
      });

      const updatedCount = event.vouchesCount + 1;
      const isPublished = updatedCount >= (event.requiredVouches || 3);

      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          vouchesCount: updatedCount,
          status: isPublished ? EventStatus.PUBLISHED : event.status,
          publishedAt: isPublished && !event.publishedAt ? new Date() : event.publishedAt,
        },
      });

      if (isPublished) {
        // Ingest into Redis Geospatial Index for Instant Map Radar queries
        await this.redis.client.geoadd(
          'koodam:events:geo',
          event.longitude,
          event.latitude,
          event.id,
        );

        // Boost host peer vouch score
        await tx.profile.updateMany({
          where: { userId: event.organizerId },
          data: { peerVouchScore: { increment: 1 } },
        });
      }

      return {
        event: updated,
        vouchCount: updatedCount,
        requiredVouches: event.requiredVouches,
        published: isPublished,
        message: isPublished
          ? 'Gathering reached 3 verified peer vouches and is now PUBLISHED on the live radar!'
          : `Endorsement recorded! (${updatedCount}/${event.requiredVouches} vouches collected).`,
      };
    });
  }
}
