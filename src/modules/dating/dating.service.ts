import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrivacyService } from '../privacy/privacy.service';
import { ProfilesService } from '../profiles/profiles.service';
import { calculateAge } from '../../common/utils/date.util';
import { formatDistance, LatLng } from '../../common/utils/geo.util';
import { DatingDiscoverQueryDto } from './dto/dating.dto';

export interface ScoredMatch {
  userId: string;
  score: number;
  displayName: string;
  age: number | null;
  gender: string;
  profession: string | null;
  homeDistrict: string | null;
  city: string | null;
  bio: string | null;
  relationshipIntention: string;
  isVerified: boolean;
  peerVouchScore: number;
  photos: Array<{ id: string; url: string; position: number; isPrimary: boolean }>;
  interests: Array<{ id: string; slug: string; name: string; emoji: string | null }>;
  culturalPrompts: Array<{ prompt: string; answer: string }>;
  distance: string | null;
  distanceKm: number | null;
  sharedInterestsCount: number;
  sharedEventsCount: number;
}

@Injectable()
export class DatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spatial: SpatialService,
    private readonly blocks: BlocksService,
    private readonly privacy: PrivacyService,
    private readonly profiles: ProfilesService,
  ) {}

  async discover(viewerId: string, query: DatingDiscoverQueryDto): Promise<ScoredMatch[]> {
    // 1. Resolve search center
    const searchCenter = await this.profiles.resolveSearchOrigin(viewerId, {
      latitude: query.latitude,
      longitude: query.longitude,
    });

    const center: LatLng = searchCenter?.point ?? { latitude: 9.9312, longitude: 76.2673 }; // Default Kochi
    const radiusKm = query.radiusKm ?? 35;

    // 2. Load viewer profile & preferences
    const [viewerProfile, viewerPrefs, blockedIds] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId: viewerId },
        include: {
          user: {
            include: {
              interests: { select: { interestId: true } },
            },
          },
        },
      }),
      this.prisma.userPreferences.findUnique({ where: { userId: viewerId } }),
      this.blocks.relatedIds(viewerId),
    ]);

    const viewerInterests = new Set(viewerProfile?.user.interests.map((i) => i.interestId) ?? []);

    // 3. Find connected or active love requested users to exclude from deck
    const [connections, loveRequests] = await Promise.all([
      this.prisma.connection.findMany({
        where: {
          OR: [{ userAId: viewerId }, { userBId: viewerId }],
          status: 'ACTIVE',
        },
        select: { userAId: true, userBId: true },
      }),
      this.prisma.loveRequest.findMany({
        where: {
          OR: [{ senderId: viewerId }, { receiverId: viewerId }],
          status: 'PENDING',
        },
        select: { senderId: true, receiverId: true },
      }),
    ]);

    const excludedIds = new Set<string>([
      viewerId,
      ...blockedIds,
      ...connections.map((c) => (c.userAId === viewerId ? c.userBId : c.userAId)),
      ...loveRequests.map((l) => (l.senderId === viewerId ? l.receiverId : l.senderId)),
    ]);

    // 4. Query candidates using PostGIS spatial radius against ghost points
    let extraWhere = Prisma.empty;
    if (query.gender) {
      extraWhere = Prisma.sql`${extraWhere} AND p.gender = ${query.gender}::gender`;
    }
    if (query.homeDistrict) {
      extraWhere = Prisma.sql`${extraWhere} AND p.home_district ILIKE ${query.homeDistrict}`;
    }
    if (query.intention) {
      extraWhere = Prisma.sql`${extraWhere} AND p.relationship_intention = ${query.intention}::relationship_intention`;
    }

    const spatialRows = await this.spatial.findPeopleIdsWithin({
      center,
      radiusKm,
      viewerId,
      limit: (query.limit ?? 20) * 3, // fetch extra to score and rank
      extraWhere,
    });

    const candidateIds = spatialRows
      .map((r) => r.id)
      .filter((id) => !excludedIds.has(id));

    if (candidateIds.length === 0) return [];

    const distanceMap = new Map(spatialRows.map((r) => [r.id, r.distance_m]));

    // 5. Load full candidate profiles with interests, events, privacy
    const candidates = await this.prisma.profile.findMany({
      where: {
        userId: { in: candidateIds },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        user: {
          include: {
            privacySettings: true,
            interests: {
              include: {
                interest: true,
              },
            },
            photos: {
              where: { status: 'ACTIVE' },
              orderBy: { position: 'asc' },
            },
            attendances: {
              where: { status: 'CONFIRMED' },
              select: { eventId: true },
            },
          },
        },
      },
    });

    // 6. Score each candidate
    const scoredMatches: ScoredMatch[] = [];

    for (const cand of candidates) {
      const pSettings = cand.user.privacySettings;
      if (pSettings?.privateMode || pSettings?.datingVisible === false) {
        continue; // Exclude users who turned off dating or enabled private mode
      }

      const candAge = cand.dateOfBirth ? calculateAge(cand.dateOfBirth) : null;
      if (candAge !== null) {
        const minAge = query.minAge ?? viewerPrefs?.minAge ?? 18;
        const maxAge = query.maxAge ?? viewerPrefs?.maxAge ?? 99;
        if (candAge < minAge || candAge > maxAge) continue;
      }

      let score = 50;

      // Shared interests score (+10 per shared interest, max 40)
      const candInterestIds = cand.user.interests.map((ci) => ci.interestId);
      const sharedInterests = candInterestIds.filter((id) => viewerInterests.has(id));
      score += Math.min(40, sharedInterests.length * 10);

      // Relationship intention match (+20)
      if (
        viewerProfile?.relationshipIntention &&
        cand.relationshipIntention === viewerProfile.relationshipIntention
      ) {
        score += 20;
      }

      // Proximity score (closer = higher, up to +15)
      const distanceMeters = distanceMap.get(cand.userId) ?? 10000;
      const distanceKm = distanceMeters / 1000;
      const proximityScore = Math.max(0, Math.round((1 - distanceKm / radiusKm) * 15));
      score += proximityScore;

      // Peer vouch score bonus (+2 per vouch, max 15)
      score += Math.min(15, (cand.peerVouchScore ?? 1) * 2);

      // Verification bonus (+10)
      if (cand.user.isVerified) score += 10;

      // Parse cultural prompts
      let culturalPrompts: Array<{ prompt: string; answer: string }> = [];
      if (Array.isArray(cand.culturalPrompts)) {
        culturalPrompts = cand.culturalPrompts as Array<{ prompt: string; answer: string }>;
      }

      scoredMatches.push({
        userId: cand.userId,
        score,
        displayName: cand.displayName,
        age: candAge,
        gender: cand.gender,
        profession: cand.profession,
        homeDistrict: cand.homeDistrict,
        city: cand.city,
        bio: cand.bio,
        relationshipIntention: cand.relationshipIntention,
        isVerified: cand.user.isVerified,
        peerVouchScore: cand.peerVouchScore,
        photos: cand.user.photos.map((p) => ({
          id: p.id,
          url: p.url,
          position: p.position,
          isPrimary: p.isPrimary,
        })),
        interests: cand.user.interests.map((i) => ({
          id: i.interest.id,
          slug: i.interest.slug,
          name: i.interest.name,
          emoji: i.interest.emoji,
        })),
        culturalPrompts,
        distance: pSettings?.showDistance ? formatDistance(distanceMeters) : null,
        distanceKm: pSettings?.showDistance ? Number(distanceKm.toFixed(1)) : null,
        sharedInterestsCount: sharedInterests.length,
        sharedEventsCount: 0,
      });
    }

    // Sort descending by calculated compatibility score
    scoredMatches.sort((a, b) => b.score - a.score);

    return scoredMatches.slice(0, query.limit ?? 20);
  }
}
