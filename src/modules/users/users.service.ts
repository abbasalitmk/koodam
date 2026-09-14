import { Injectable, Logger } from '@nestjs/common';
import { PhotoStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { AddPhotoDto, DeleteAccountDto, RegisterDeviceTokenDto, ReorderPhotosDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listInterests() {
    return this.prisma.interest.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, emoji: true, category: true },
    });
  }

  async getMyInterests(userId: string) {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
      orderBy: { interest: { name: 'asc' } },
    });
    return rows.map((r) => ({
      id: r.interest.id,
      slug: r.interest.slug,
      name: r.interest.name,
      emoji: r.interest.emoji,
      category: r.interest.category,
    }));
  }

  async addPhoto(userId: string, dto: AddPhotoDto) {
    const existingCount = await this.prisma.profilePhoto.count({
      where: { userId, status: PhotoStatus.ACTIVE },
    });

    if (existingCount >= 6) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'Maximum 6 photos allowed per profile',
      );
    }

    const isFirst = existingCount === 0;
    const isPrimary = dto.isPrimary ?? isFirst;

    return this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.profilePhoto.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
      }

      const photo = await tx.profilePhoto.create({
        data: {
          userId,
          url: dto.url,
          storageKey: dto.storageKey,
          position: dto.position ?? existingCount,
          isPrimary,
          width: dto.width,
          height: dto.height,
          status: PhotoStatus.ACTIVE,
        },
      });

      return photo;
    });
  }

  async deletePhoto(userId: string, photoId: string) {
    const photo = await this.prisma.profilePhoto.findFirst({
      where: { id: photoId, userId, status: PhotoStatus.ACTIVE },
    });

    if (!photo) throw AppException.notFound('Photo');

    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.update({
        where: { id: photoId },
        data: { status: PhotoStatus.DELETED },
      });

      // If primary was deleted, promote next available photo
      if (photo.isPrimary) {
        const next = await tx.profilePhoto.findFirst({
          where: { userId, status: PhotoStatus.ACTIVE },
          orderBy: { position: 'asc' },
        });
        if (next) {
          await tx.profilePhoto.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    return { deleted: true, photoId };
  }

  async setPrimaryPhoto(userId: string, photoId: string) {
    const photo = await this.prisma.profilePhoto.findFirst({
      where: { id: photoId, userId, status: PhotoStatus.ACTIVE },
    });
    if (!photo) throw AppException.notFound('Photo');

    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
      await tx.profilePhoto.update({
        where: { id: photoId },
        data: { isPrimary: true },
      });
    });

    return { updated: true, photoId, isPrimary: true };
  }

  async reorderPhotos(userId: string, dto: ReorderPhotosDto) {
    await this.prisma.$transaction(
      dto.order.map((item) =>
        this.prisma.profilePhoto.updateMany({
          where: { id: item.photoId, userId },
          data: { position: item.position },
        }),
      ),
    );
    return { reordered: true };
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform, isActive: true, updatedAt: new Date() },
      create: { userId, token: dto.token, platform: dto.platform, isActive: true },
    });
    return { registered: true };
  }

  async unregisterDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token, userId },
    });
    return { unregistered: true };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    this.logger.log(`Deleting account for user ${userId}. Reason: ${dto.reason ?? 'None provided'}`);

    await this.prisma.$transaction(async (tx) => {
      // Deactivate user status and set deletedAt
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
        },
      });

      // Clear device tokens so no push notifications go out
      await tx.deviceToken.deleteMany({ where: { userId } });

      // Anonymize profile location and hide from discovery
      await tx.profile.updateMany({
        where: { userId },
        data: {
          currentLat: null,
          currentLng: null,
          ghostLat: null,
          ghostLng: null,
          bio: '[Account Deleted]',
          displayName: 'Deleted User',
        },
      });

      // Turn on privateMode
      await tx.userPrivacySettings.upsert({
        where: { userId },
        update: { privateMode: true, showInDiscover: false, showOnPeopleMap: false },
        create: { userId, privateMode: true, showInDiscover: false, showOnPeopleMap: false },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    // Invalidate caches
    await this.redis.client.del(`privacy:${userId}`);
    await this.redis.client.del(`blocks:${userId}`);

    return { deleted: true, message: 'Account successfully scheduled for permanent deletion' };
  }
}
