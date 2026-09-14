import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, RelationshipIntention, VerificationStatus } from '@prisma/client';

export class PhotoDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() position!: number;
  @ApiProperty() isPrimary!: boolean;
}

export class InterestDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) emoji!: string | null;
}

export class CulturalPromptResponseDto {
  @ApiProperty() prompt!: string;
  @ApiProperty() answer!: string;
}

/**
 * The shape returned for *other* users.
 *
 * Deliberately absent: dateOfBirth, email, phone, latitude, longitude, the
 * user's home location and their exact last-seen time. `distance` is a coarse,
 * pre-formatted string and is omitted entirely when the viewer or the subject
 * has turned distance sharing off.
 */
export class PublicProfileDto {
  @ApiProperty() userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ description: 'Derived from date of birth, which is never exposed' })
  age!: number;
  @ApiProperty({ enum: Gender }) gender!: Gender;
  @ApiPropertyOptional({ nullable: true }) bio!: string | null;
  @ApiPropertyOptional({ nullable: true }) profession!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'District the user is rooted in' })
  homeDistrict!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'City only — never a precise place' })
  city!: string | null;
  @ApiPropertyOptional({ nullable: true }) district!: string | null;
  @ApiProperty({ enum: RelationshipIntention }) relationshipIntention!: RelationshipIntention;
  @ApiProperty({ enum: VerificationStatus }) verification!: VerificationStatus;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty() peerVouchScore!: number;
  @ApiProperty({ type: [PhotoDto] }) photos!: PhotoDto[];
  @ApiProperty({ type: [InterestDto] }) interests!: InterestDto[];
  @ApiProperty({ type: [CulturalPromptResponseDto] })
  culturalPrompts!: CulturalPromptResponseDto[];

  @ApiPropertyOptional({ example: '2.4 km away', nullable: true })
  distance?: string | null;
  @ApiPropertyOptional({ description: 'Number of interests in common with the viewer' })
  sharedInterests?: number;
  @ApiPropertyOptional({ description: 'Events both the viewer and this user are attending' })
  sharedEvents?: number;
  @ApiPropertyOptional({ nullable: true, description: 'Coarse activity bucket, not a timestamp' })
  lastActive?: string | null;
  @ApiPropertyOptional() isConnected?: boolean;
  @ApiPropertyOptional() hasPendingLoveRequest?: boolean;
}

/** Everything the owner may see about their own profile. */
export class MyProfileDto extends PublicProfileDto {
  @ApiProperty({ format: 'date' }) dateOfBirth!: string;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiProperty() isProfileComplete!: boolean;
  @ApiPropertyOptional({ type: [String] }) languages!: string[];
  @ApiPropertyOptional({ nullable: true, description: 'Precise coordinates, owner only' })
  currentLocation!: { latitude: number; longitude: number } | null;
  @ApiPropertyOptional({ nullable: true })
  exploringLocation!: { id: string; name: string; latitude: number; longitude: number } | null;
  @ApiProperty() locationMode!: string;
  @ApiPropertyOptional({ nullable: true }) locationUpdatedAt!: string | null;
}

/**
 * Returned when a profile exists but the viewer may not see it — private mode,
 * a block, or a suspended account. Carries only enough to render a placeholder.
 */
export class RestrictedProfileDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ example: 'This profile is not available' }) message!: string;
  @ApiProperty({ example: 'PRIVATE_MODE' }) reason!: string;
}
