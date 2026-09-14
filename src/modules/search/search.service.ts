import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { calculateAge } from '../../common/utils/date.util';
import { SearchQueryDto, SearchType } from './dto/search.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async search(currentUserId: string | undefined, query: SearchQueryDto) {
    const q = query.q.trim();
    const limit = query.limit ?? 15;
    const type = query.type ?? SearchType.ALL;

    const [events, people, locations, interests] = await Promise.all([
      type === SearchType.ALL || type === SearchType.EVENTS
        ? this.searchEvents(q, limit)
        : Promise.resolve([]),
      type === SearchType.ALL || type === SearchType.PEOPLE
        ? this.searchPeople(currentUserId, q, limit)
        : Promise.resolve([]),
      type === SearchType.ALL || type === SearchType.LOCATIONS
        ? this.searchLocations(q, limit)
        : Promise.resolve([]),
      type === SearchType.ALL || type === SearchType.INTERESTS
        ? this.searchInterests(q, limit)
        : Promise.resolve([]),
    ]);

    return {
      query: q,
      results: {
        events,
        people,
        locations,
        interests,
      },
    };
  }

  private async searchEvents(q: string, limit: number) {
    return this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        privacy: 'PUBLIC',
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
          { locationName: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        category: true,
      },
      orderBy: [{ isFeatured: 'desc' }, { startTime: 'asc' }],
      take: limit,
    });
  }

  private async searchPeople(viewerId: string | undefined, q: string, limit: number) {
    const blockedIds = viewerId ? await this.blocks.relatedIds(viewerId) : [];

    const rows = await this.prisma.profile.findMany({
      where: {
        isProfileComplete: true,
        userId: viewerId ? { notIn: [viewerId, ...blockedIds] } : undefined,
        user: { status: 'ACTIVE', deletedAt: null },
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { profession: { contains: q, mode: 'insensitive' } },
          { homeDistrict: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        user: {
          include: {
            privacySettings: true,
            photos: { where: { isPrimary: true, status: 'ACTIVE' }, take: 1 },
          },
        },
      },
      take: limit,
    });

    return rows
      .filter((p) => !p.user.privacySettings?.privateMode && p.user.privacySettings?.showInDiscover !== false)
      .map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        age: p.dateOfBirth ? calculateAge(p.dateOfBirth) : null,
        gender: p.gender,
        profession: p.profession,
        homeDistrict: p.homeDistrict,
        city: p.city,
        avatarUrl: p.user.photos[0]?.url ?? null,
      }));
  }

  private async searchLocations(q: string, limit: number) {
    return this.prisma.location.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { searchTerms: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ isKerala: 'desc' }, { population: 'desc' }],
      take: limit,
    });
  }

  private async searchInterests(q: string, limit: number) {
    return this.prisma.interest.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q.toLowerCase(), mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
  }
}
