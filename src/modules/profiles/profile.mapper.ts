import { Injectable } from '@nestjs/common';
import { Gender, Prisma, VerificationStatus } from '@prisma/client';
import { calculateAge } from '../../common/utils/date.util';
import { formatDistance } from '../../common/utils/geo.util';
import {
  CulturalPromptResponseDto,
  InterestDto,
  MyProfileDto,
  PhotoDto,
  PublicProfileDto,
} from './dto/profile-response.dto';

export const PROFILE_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      isVerified: true,
      lastActiveAt: true,
      photos: {
        where: { status: 'ACTIVE' as const },
        orderBy: { position: 'asc' as const },
        select: { id: true, url: true, position: true, isPrimary: true },
      },
      interests: {
        select: {
          interest: { select: { id: true, slug: true, name: true, emoji: true } },
        },
      },
    },
  },
  exploringLocation: { select: { id: true, name: true, latitude: true, longitude: true } },
} satisfies Prisma.ProfileInclude;

export type ProfileWithRelations = Prisma.ProfileGetPayload<{ include: typeof PROFILE_INCLUDE }>;

export interface PublicProfileContext {
  /** Metres between viewer and subject; omitted when either side hides distance. */
  distanceMeters?: number | null;
  showDistance?: boolean;
  showOnlineStatus?: boolean;
  sharedInterests?: number;
  sharedEvents?: number;
  isConnected?: boolean;
  hasPendingLoveRequest?: boolean;
}

/**
 * Single place where a database row becomes a client-visible profile.
 *
 * Every consumer goes through here, which is what makes "never expose date of
 * birth or coordinates" an enforceable rule rather than a convention.
 */
@Injectable()
export class ProfileMapper {
  toPublic(profile: ProfileWithRelations, ctx: PublicProfileContext = {}): PublicProfileDto {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      age: calculateAge(profile.dateOfBirth),
      gender: profile.gender as Gender,
      bio: profile.bio,
      profession: profile.profession,
      homeDistrict: profile.homeDistrict,
      city: profile.city,
      district: profile.district,
      relationshipIntention: profile.relationshipIntention,
      verification: profile.verification as VerificationStatus,
      isVerified: profile.user.isVerified,
      peerVouchScore: profile.peerVouchScore,
      photos: this.toPhotos(profile),
      interests: this.toInterests(profile),
      culturalPrompts: this.toPrompts(profile.culturalPrompts),
      distance:
        ctx.showDistance !== false && ctx.distanceMeters != null
          ? formatDistance(ctx.distanceMeters)
          : null,
      sharedInterests: ctx.sharedInterests,
      sharedEvents: ctx.sharedEvents,
      lastActive:
        ctx.showOnlineStatus === false ? null : this.activityBucket(profile.user.lastActiveAt),
      isConnected: ctx.isConnected,
      hasPendingLoveRequest: ctx.hasPendingLoveRequest,
    };
  }

  toMine(profile: ProfileWithRelations): MyProfileDto {
    return {
      ...this.toPublic(profile, { showDistance: false, showOnlineStatus: true }),
      dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
      email: profile.user.email,
      phone: profile.user.phone,
      isProfileComplete: profile.isProfileComplete,
      languages: profile.languages,
      currentLocation:
        profile.currentLat != null && profile.currentLng != null
          ? { latitude: profile.currentLat, longitude: profile.currentLng }
          : null,
      exploringLocation: profile.exploringLocation
        ? {
            id: profile.exploringLocation.id,
            name: profile.exploringLocation.name,
            latitude: profile.exploringLocation.latitude,
            longitude: profile.exploringLocation.longitude,
          }
        : null,
      locationMode: profile.locationMode,
      locationUpdatedAt: profile.locationUpdatedAt?.toISOString() ?? null,
      distance: null,
    };
  }

  private toPhotos(profile: ProfileWithRelations): PhotoDto[] {
    return profile.user.photos.map((p) => ({
      id: p.id,
      url: p.url,
      position: p.position,
      isPrimary: p.isPrimary,
    }));
  }

  private toInterests(profile: ProfileWithRelations): InterestDto[] {
    return profile.user.interests.map((ui) => ({
      id: ui.interest.id,
      slug: ui.interest.slug,
      name: ui.interest.name,
      emoji: ui.interest.emoji,
    }));
  }

  private toPrompts(raw: Prisma.JsonValue): CulturalPromptResponseDto[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is { prompt: string; answer: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { prompt?: unknown }).prompt === 'string' &&
          typeof (item as { answer?: unknown }).answer === 'string',
      )
      .map((item) => ({ prompt: item.prompt, answer: item.answer }));
  }

  /**
   * Coarse buckets instead of a timestamp. "Online now" plus a precise
   * last-seen is enough to infer sleep schedules and daily routine.
   */
  private activityBucket(lastActiveAt: Date): string {
    const minutes = (Date.now() - lastActiveAt.getTime()) / 60_000;
    if (minutes < 10) return 'Online now';
    if (minutes < 60) return 'Active recently';
    if (minutes < 60 * 24) return 'Active today';
    if (minutes < 60 * 24 * 7) return 'Active this week';
    return 'Active a while ago';
  }
}
