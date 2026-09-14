import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender, RelationshipIntention } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CulturalPromptDto {
  @ApiProperty({ example: 'Sunday morning ritual' })
  @IsString()
  @MaxLength(80)
  prompt!: string;

  @ApiProperty({ example: 'Appam at Paragon with three pages of a Basheer book.' })
  @IsString()
  @MaxLength(240)
  answer!: string;
}

export class CreateProfileDto {
  @ApiProperty({ example: 'Devika S.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ example: '1999-04-12', description: 'Never returned by the API; age is derived' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string;

  @ApiPropertyOptional({ example: 'Architect' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ example: 'Thrissur', description: 'District the user is rooted in' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  homeDistrict?: string;

  @ApiPropertyOptional({ example: 'Kozhikode' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Kozhikode' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  district?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @ApiPropertyOptional({ enum: RelationshipIntention })
  @IsOptional()
  @IsEnum(RelationshipIntention)
  relationshipIntention?: RelationshipIntention;

  @ApiPropertyOptional({ type: [CulturalPromptDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CulturalPromptDto)
  culturalPrompts?: CulturalPromptDto[];

  @ApiPropertyOptional({ type: [String], example: ['Malayalam', 'English'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Interest slugs', maxItems: 12 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  interests?: string[];
}

export class UpdateProfileDto extends PartialType(CreateProfileDto) {}

export class UpdateLocationDto {
  @ApiProperty({ example: 11.2588 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 75.7804 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in metres, for staleness heuristics' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  accuracy?: number;
}

export class SetExploringLocationDto {
  @ApiProperty({ description: 'Id of a seeded location to explore' })
  @IsUUID()
  locationId!: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ minimum: 18, maximum: 99 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(18)
  @Max(99)
  minAge?: number;

  @ApiPropertyOptional({ minimum: 18, maximum: 99 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(18)
  @Max(99)
  maxAge?: number;

  @ApiPropertyOptional({ enum: Gender, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  preferredGenders?: Gender[];

  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxDistanceKm?: number;

  @ApiPropertyOptional({ enum: RelationshipIntention, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipIntention, { each: true })
  relationshipIntentions?: RelationshipIntention[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(10)
  preferredLocationIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(14)
  eventCategoryIds?: string[];
}

export class SetInterestsDto {
  @ApiProperty({ type: [String], description: 'Interest slugs', maxItems: 12 })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v).trim()) : value))
  interests!: string[];
}
