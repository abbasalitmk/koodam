import { Injectable } from '@nestjs/common';
import { MessagePermission, UserPrivacySettings } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { UpdatePrivacyDto } from './dto/privacy.dto';

const CACHE_TTL_SECONDS = 120;
const cacheKey = (userId: string) => `privacy:${userId}`;

export const DEFAULT_PRIVACY: Omit<UserPrivacySettings, 'userId' | 'updatedAt'> = {
  privateMode: false,
  showInDiscover: true,
  showOnPeopleMap: true,
  showDistance: true,
  showOnlineStatus: true,
  showLocation: true,
  allowLoveRequests: true,
  allowMessages: MessagePermission.CONNECTIONS_ONLY,
  readReceipts: true,
  datingVisible: true,
};

/**
 * Resolves a user's privacy settings, with defaults for accounts that have not
 * touched them. Read on almost every discovery request, hence the cache.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(userId: string): Promise<typeof DEFAULT_PRIVACY> {
    const cached = await this.redis.getJson<typeof DEFAULT_PRIVACY>(cacheKey(userId));
    if (cached) return cached;

    const row = await this.prisma.userPrivacySettings.findUnique({ where: { userId } });
    const settings = row ? this.strip(row) : DEFAULT_PRIVACY;
    await this.redis.setJson(cacheKey(userId), settings, CACHE_TTL_SECONDS);
    return settings;
  }

  async getMany(userIds: string[]): Promise<Map<string, typeof DEFAULT_PRIVACY>> {
    const rows = await this.prisma.userPrivacySettings.findMany({
      where: { userId: { in: userIds } },
    });
    const map = new Map(rows.map((r) => [r.userId, this.strip(r)]));
    for (const id of userIds) if (!map.has(id)) map.set(id, DEFAULT_PRIVACY);
    return map;
  }

  async update(userId: string, dto: UpdatePrivacyDto) {
    const row = await this.prisma.userPrivacySettings.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    await this.redis.client.del(cacheKey(userId));
    return this.strip(row);
  }

  /**
   * Whether `viewerId` may see `subjectId` in a browse/discovery surface.
   * Private Mode still allows the subject to appear once they have initiated
   * contact, which is handled by the caller passing `hasInteraction`.
   */
  async isDiscoverableBy(
    subject: typeof DEFAULT_PRIVACY,
    surface: 'discover' | 'map' | 'dating',
    hasInteraction = false,
  ): Promise<boolean> {
    if (subject.privateMode && !hasInteraction) return false;
    switch (surface) {
      case 'map':
        return subject.showOnPeopleMap;
      case 'dating':
        return subject.datingVisible && subject.showInDiscover;
      default:
        return subject.showInDiscover;
    }
  }

  private strip(row: UserPrivacySettings): typeof DEFAULT_PRIVACY {
    const { userId: _userId, updatedAt: _updatedAt, ...rest } = row;
    return rest;
  }
}
