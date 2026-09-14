import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrivacyService } from '../privacy/privacy.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { calculateAge } from '../../common/utils/date.util';
import { computeGhostPoint, haversineMeters, LatLng } from '../../common/utils/geo.util';
import { DiscoveryConfig } from '../../config/configuration';
import { PROFILE_INCLUDE, ProfileMapper, ProfileWithRelations } from './profile.mapper';
import {
  CreateProfileDto,
  SetInterestsDto,
  UpdateLocationDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { MyProfileDto, PublicProfileDto, RestrictedProfileDto } from './dto/profile-response.dto';

/** Re-ghost only when the user has actually moved; see updateLocation. */
const GHOST_REFRESH_DISTANCE_M = 250;

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spatial: SpatialService,
    private readonly blocks: BlocksService,
    private readonly privacy: PrivacyService,
    private readonly mapper: ProfileMapper,
    private readonly config: ConfigService,
  ) {}

  private get discovery(): DiscoveryConfig {
    return this.config.getOrThrow<DiscoveryConfig>('discovery');
  }

  async createOrUpdateMine(userId: string, dto: CreateProfileDto): Promise<MyProfileDto> {
    const dateOfBirth = new Date(dto.dateOfBirth);
    const age = calculateAge(dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime()) || age < 18) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'You must be at least 18 years old to use Koodam',
      );
    }
    if (age > 120) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Date of birth is not valid');
    }

    const data = {
      displayName: dto.displayName,
      dateOfBirth,
      gender: dto.gender,
      bio: dto.bio,
      profession: dto.profession,
      homeDistrict: dto.homeDistrict,
      city: dto.city,
      district: dto.district,
      country: dto.country ?? 'India',
      relationshipIntention: dto.relationshipIntention,
      culturalPrompts: (dto.culturalPrompts ?? []) as unknown as Prisma.InputJsonValue,
      languages: dto.languages ?? [],
    };

    await this.prisma.profile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    if (dto.interests) await this.setInterests(userId, { interests: dto.interests });

    await this.recomputeCompleteness(userId);
    return this.getMine(userId);
  }

  async updateMine(userId: string, dto: UpdateProfileDto): Promise<MyProfileDto> {
    await this.requireProfile(userId);

    const data: Prisma.ProfileUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.profession !== undefined) data.profession = dto.profession;
    if (dto.homeDistrict !== undefined) data.homeDistrict = dto.homeDistrict;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.district !== undefined) data.district = dto.district;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.relationshipIntention !== undefined) {
      data.relationshipIntention = dto.relationshipIntention;
    }
    if (dto.languages !== undefined) data.languages = dto.languages;
    if (dto.culturalPrompts !== undefined) {
      data.culturalPrompts = dto.culturalPrompts as unknown as Prisma.InputJsonValue;
    }
    if (dto.dateOfBirth !== undefined) {
      const dob = new Date(dto.dateOfBirth);
      if (calculateAge(dob) < 18) {
        throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'You must be at least 18');
      }
      data.dateOfBirth = dob;
    }

    await this.prisma.profile.update({ where: { userId }, data });
    if (dto.interests) await this.setInterests(userId, { interests: dto.interests });

    await this.recomputeCompleteness(userId);
    return this.getMine(userId);
  }

  async getMine(userId: string): Promise<MyProfileDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new AppException(
        ErrorCode.PROFILE_INCOMPLETE,
        'Finish onboarding to create your profile',
        404,
      );
    }
    return this.mapper.toMine(profile);
  }

  /**
   * A profile as seen by another user. Applies blocks, Private Mode and the
   * subject's distance/online-status preferences before mapping.
   */
  async getPublic(
    viewerId: string,
    targetUserId: string,
  ): Promise<PublicProfileDto | RestrictedProfileDto> {
    if (viewerId === targetUserId) return this.getMine(viewerId);

    if (await this.blocks.isBlockedEither(viewerId, targetUserId)) {
      return {
        userId: targetUserId,
        message: 'This profile is not available',
        reason: 'BLOCKED',
      };
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: targetUserId },
      include: PROFILE_INCLUDE,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { status: true, deletedAt: true },
    });

    if (!profile || !user || user.deletedAt || user.status !== 'ACTIVE') {
      throw AppException.notFound('Profile');
    }

    const settings = await this.privacy.get(targetUserId);
    const hasInteraction = await this.hasInteraction(viewerId, targetUserId);

    if (settings.privateMode && !hasInteraction) {
      return {
        userId: targetUserId,
        message: 'This member is in Private Mode',
        reason: 'PRIVATE_MODE',
      };
    }

    const [distanceMeters, sharedInterests, sharedEvents, isConnected, pendingLove] =
      await Promise.all([
        settings.showDistance ? this.spatial.distanceBetweenUsers(viewerId, targetUserId) : null,
        this.countSharedInterests(viewerId, targetUserId),
        this.countSharedEvents(viewerId, targetUserId),
        this.areConnected(viewerId, targetUserId),
        this.hasPendingLoveRequest(viewerId, targetUserId),
      ]);

    return this.mapper.toPublic(profile, {
      distanceMeters,
      showDistance: settings.showDistance,
      showOnlineStatus: settings.showOnlineStatus,
      sharedInterests,
      sharedEvents,
      isConnected,
      hasPendingLoveRequest: pendingLove,
    });
  }

  /**
   * Stores the device's GPS fix.
   *
   * The precise point never leaves the server. A ghosted twin is written at the
   * same time and is the only thing spatial discovery reads. The ghost is
   * re-randomised only after real movement — regenerating it on every ping would
   * let an observer average successive readings back to the true position.
   */
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { currentLat: true, currentLng: true, ghostLat: true, ghostLng: true },
    });
    if (!profile) {
      throw new AppException(ErrorCode.PROFILE_INCOMPLETE, 'Create your profile first', 400);
    }

    const real: LatLng = { latitude: dto.latitude, longitude: dto.longitude };
    const { ghostRadiusMinM, ghostRadiusMaxM } = this.discovery;

    const moved =
      profile.currentLat == null ||
      profile.currentLng == null ||
      haversineMeters(
        { latitude: profile.currentLat, longitude: profile.currentLng },
        real,
      ) > GHOST_REFRESH_DISTANCE_M;

    const ghost =
      moved || profile.ghostLat == null || profile.ghostLng == null
        ? computeGhostPoint(real, ghostRadiusMinM, ghostRadiusMaxM)
        : { latitude: profile.ghostLat, longitude: profile.ghostLng };

    await this.spatial.updateProfileLocation(userId, real, ghost);

    // Resolve the fix to a seeded place so the feed can label "Kozhikode, KL".
    const resolved = await this.spatial.reverseResolveLocation(real);
    if (resolved) {
      await this.prisma.profile.update({
        where: { userId },
        data: { currentLocationId: resolved.id },
      });
    }

    return {
      updated: true,
      resolvedPlace: resolved?.name ?? null,
      // Echo the ghost, not the real point, so client logs never hold precise GPS.
      approximatePoint: { latitude: ghost.latitude, longitude: ghost.longitude },
    };
  }

  /**
   * Sets the "explore elsewhere" location. This never touches the user's real
   * position: someone in Dubai exploring Kochi is still physically in Dubai.
   */
  async setExploringLocation(userId: string, locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, latitude: true, longitude: true, kind: true },
    });
    if (!location) throw AppException.notFound('Location');

    await this.prisma.profile.update({
      where: { userId },
      data: { exploringLocationId: location.id, locationMode: LocationMode.CHOOSE_LOCATION },
    });
    await this.spatial.updateExploringLocation(userId, {
      latitude: location.latitude,
      longitude: location.longitude,
    });

    return {
      exploring: {
        id: location.id,
        name: location.name,
        kind: location.kind,
        latitude: location.latitude,
        longitude: location.longitude,
      },
    };
  }

  async clearExploringLocation(userId: string) {
    await this.prisma.profile.update({
      where: { userId },
      data: { exploringLocationId: null, locationMode: LocationMode.NEAR_ME },
    });
    await this.spatial.updateExploringLocation(userId, null);
    return { exploring: null, locationMode: LocationMode.NEAR_ME };
  }

  async setLocationMode(userId: string, mode: LocationMode) {
    await this.prisma.profile.update({ where: { userId }, data: { locationMode: mode } });
    return { locationMode: mode };
  }

  async setInterests(userId: string, dto: SetInterestsDto) {
    const interests = await this.prisma.interest.findMany({
      where: { slug: { in: dto.interests }, isActive: true },
      select: { id: true, slug: true, name: true, emoji: true },
    });

    const unknown = dto.interests.filter((slug) => !interests.some((i) => i.slug === slug));
    if (unknown.length > 0) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        `Unknown interests: ${unknown.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: interests.map((i) => ({ userId, interestId: i.id })),
        skipDuplicates: true,
      }),
    ]);

    await this.recomputeCompleteness(userId);
    return interests;
  }

  async getPreferences(userId: string) {
    const row = await this.prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const { userId: _u, updatedAt: _t, ...rest } = row;
    return rest;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    if (dto.minAge != null && dto.maxAge != null && dto.minAge > dto.maxAge) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'Minimum age cannot be greater than maximum age',
      );
    }
    const row = await this.prisma.userPreferences.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    const { userId: _u, updatedAt: _t, ...rest } = row;
    return rest;
  }

  /**
   * The point discovery should search from, honouring the user's location mode.
   * Returns null when no position is known, which callers surface as
   * LOCATION_REQUIRED rather than silently defaulting to somewhere.
   */
  async resolveSearchOrigin(
    userId: string,
    override?: Partial<LatLng>,
  ): Promise<{ point: LatLng; source: 'override' | 'exploring' | 'current' } | null> {
    if (override?.latitude != null && override?.longitude != null) {
      return {
        point: { latitude: override.latitude, longitude: override.longitude },
        source: 'override',
      };
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        locationMode: true,
        currentLat: true,
        currentLng: true,
        exploringLat: true,
        exploringLng: true,
      },
    });
    if (!profile) return null;

    if (
      profile.locationMode === LocationMode.CHOOSE_LOCATION &&
      profile.exploringLat != null &&
      profile.exploringLng != null
    ) {
      return {
        point: { latitude: profile.exploringLat, longitude: profile.exploringLng },
        source: 'exploring',
      };
    }

    if (profile.currentLat != null && profile.currentLng != null) {
      return {
        point: { latitude: profile.currentLat, longitude: profile.currentLng },
        source: 'current',
      };
    }

    // Fall back to an explicitly chosen location even in NEAR_ME mode, rather
    // than failing, when the device has never reported a fix.
    if (profile.exploringLat != null && profile.exploringLng != null) {
      return {
        point: { latitude: profile.exploringLat, longitude: profile.exploringLng },
        source: 'exploring',
      };
    }

    return null;
  }

  async requireSearchOrigin(userId: string, override?: Partial<LatLng>): Promise<LatLng> {
    const origin = await this.resolveSearchOrigin(userId, override);
    if (!origin) {
      throw new AppException(
        ErrorCode.LOCATION_REQUIRED,
        'Share your location or choose a place to explore first',
        400,
      );
    }
    return origin.point;
  }

  async loadWithRelations(userIds: string[]): Promise<Map<string, ProfileWithRelations>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.profile.findMany({
      where: { userId: { in: userIds } },
      include: PROFILE_INCLUDE,
    });
    return new Map(rows.map((r) => [r.userId, r]));
  }

  /** A profile is "complete" once it can render usefully in discovery. */
  private async recomputeCompleteness(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        dateOfBirth: true,
        gender: true,
        bio: true,
        user: {
          select: {
            photos: { where: { status: 'ACTIVE' }, select: { id: true } },
            interests: { select: { interestId: true } },
          },
        },
      },
    });
    if (!profile) return;

    const complete =
      Boolean(profile.displayName) &&
      Boolean(profile.dateOfBirth) &&
      Boolean(profile.gender) &&
      profile.user.photos.length >= 1 &&
      profile.user.interests.length >= 1;

    await this.prisma.profile.update({
      where: { userId },
      data: { isProfileComplete: complete },
    });
  }

  private async requireProfile(userId: string) {
    const exists = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!exists) {
      throw new AppException(ErrorCode.PROFILE_INCOMPLETE, 'Create your profile first', 400);
    }
  }

  private async countSharedInterests(a: string, b: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
        FROM user_interests ua
        JOIN user_interests ub ON ua.interest_id = ub.interest_id
       WHERE ua.user_id = ${a}::uuid AND ub.user_id = ${b}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async countSharedEvents(a: string, b: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
        FROM event_attendees ea
        JOIN event_attendees eb ON ea.event_id = eb.event_id
       WHERE ea.user_id = ${a}::uuid AND eb.user_id = ${b}::uuid
         AND ea.status IN ('CONFIRMED', 'CHECKED_IN')
         AND eb.status IN ('CONFIRMED', 'CHECKED_IN')
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async areConnected(a: string, b: string): Promise<boolean> {
    const [userAId, userBId] = [a, b].sort();
    const row = await this.prisma.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { status: true },
    });
    return row?.status === 'ACTIVE';
  }

  private async hasPendingLoveRequest(senderId: string, receiverId: string): Promise<boolean> {
    const row = await this.prisma.loveRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
      select: { status: true },
    });
    return row?.status === 'PENDING';
  }

  /** True when the pair already has a relationship that overrides Private Mode. */
  private async hasInteraction(viewerId: string, targetId: string): Promise<boolean> {
    const [userAId, userBId] = [viewerId, targetId].sort();
    const [connection, love] = await Promise.all([
      this.prisma.connection.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        select: { status: true },
      }),
      this.prisma.loveRequest.findFirst({
        where: {
          OR: [
            { senderId: targetId, receiverId: viewerId },
            { senderId: viewerId, receiverId: targetId, status: 'ACCEPTED' },
          ],
        },
        select: { id: true },
      }),
    ]);
    return connection?.status === 'ACTIVE' || Boolean(love);
  }
}
