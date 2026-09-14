import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { Paginated } from '../../common/dto/api-response.dto';

const CACHE_TTL_SECONDS = 300;
const cacheKey = (userId: string) => `blocks:${userId}`;

/**
 * Blocking is checked on nearly every read path, so the relation set for a user
 * is cached in Redis and invalidated on write. `isBlockedEither` is deliberately
 * symmetric: a block hides both directions, so neither party can see or reach
 * the other regardless of who initiated it.
 */
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async block(blockerId: string, blockedId: string, reason?: string) {
    if (blockerId === blockedId) {
      throw AppException.badRequest(ErrorCode.SELF_ACTION, 'You cannot block yourself');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: blockedId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw AppException.notFound('User');

    await this.prisma.$transaction(async (tx) => {
      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: { reason },
        create: { blockerId, blockedId, reason },
      });

      // A block tears down the existing relationship in both directions.
      const [a, b] = [blockerId, blockedId].sort();
      await tx.connection.updateMany({
        where: { userAId: a, userBId: b },
        data: { status: 'BLOCKED' },
      });

      await tx.loveRequest.updateMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: blockedId },
            { senderId: blockedId, receiverId: blockerId },
          ],
          status: 'PENDING',
        },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
    });

    await this.invalidate(blockerId, blockedId);
    return { blocked: true, userId: blockedId };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    await this.invalidate(blockerId, blockedId);
    return { blocked: false, userId: blockedId };
  }

  async list(userId: string, limit = 50) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        reason: true,
        blocked: {
          select: {
            id: true,
            profile: { select: { displayName: true } },
            photos: {
              where: { isPrimary: true, status: 'ACTIVE' },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    });

    return new Paginated(
      rows.map((row) => ({
        id: row.id,
        userId: row.blocked.id,
        displayName: row.blocked.profile?.displayName ?? 'Koodam member',
        avatarUrl: row.blocked.photos[0]?.url ?? null,
        reason: row.reason,
        blockedAt: row.createdAt.toISOString(),
      })),
      { hasMore: rows.length === limit, nextCursor: null },
    );
  }

  /** Every user id in a block relation with `userId`, in either direction. */
  async relatedIds(userId: string): Promise<string[]> {
    const cached = await this.redis.getJson<string[]>(cacheKey(userId));
    if (cached) return cached;

    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });

    const ids = [
      ...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId))),
    ];
    await this.redis.setJson(cacheKey(userId), ids, CACHE_TTL_SECONDS);
    return ids;
  }

  async isBlockedEither(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const ids = await this.relatedIds(userA);
    return ids.includes(userB);
  }

  /** Throws when either party has blocked the other. */
  async assertNotBlocked(userA: string, userB: string): Promise<void> {
    if (await this.isBlockedEither(userA, userB)) {
      throw new AppException(
        ErrorCode.BLOCKED,
        'This action is not available for this profile',
        403,
      );
    }
  }

  private async invalidate(...userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((id) => this.redis.client.del(cacheKey(id))));
  }
}
