import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventFormat, EventPrivacy, PricingType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Sunset Sulaimani & Acoustic Jam at Fort Kochi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title!: string;

  @ApiProperty({ example: 'Bring your acoustic guitars, ukuleles, or just love for Malabar indie jams.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'UUID of event category' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: 'https://storage.koodam.app/events/acoustic.jpg' })
  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @ApiProperty({ enum: EventFormat, default: EventFormat.CASUAL_MEETUP })
  @IsEnum(EventFormat)
  format!: EventFormat;

  @ApiProperty({ enum: EventPrivacy, default: EventPrivacy.PUBLIC })
  @IsEnum(EventPrivacy)
  privacy!: EventPrivacy;

  @ApiProperty({ example: '2026-10-15', description: 'Single calendar date for the gathering' })
  @IsDateString()
  eventDate!: string;

  @ApiProperty({ example: '16:30:00', description: 'Start time on the event date (HH:mm:ss)' })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '20:00:00', description: 'End time on the same date (max 8 hours duration)' })
  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({ example: 'Kochi Biennale Courtyard' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  locationName!: string;

  @ApiProperty({ example: '1/240 Aspinwall House, Fort Kochi' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({ example: 'Kochi' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Ernakulam' })
  @IsString()
  @IsNotEmpty()
  district!: string;

  @ApiPropertyOptional({ example: 'Kerala' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 9.9658 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 76.2441 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ default: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(1000)
  maxAttendees?: number;

  @ApiPropertyOptional({ enum: PricingType, default: PricingType.FREE })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'koodam@okhdfcbank' })
  @IsOptional()
  @IsString()
  upiId?: string;

  @ApiPropertyOptional({ default: true, description: 'Auto-balance male and female reservations for social equilibrium' })
  @IsOptional()
  @IsBoolean()
  genderBalanceEnforced?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowChat?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowAttendeeDiscovery?: boolean;
}

export class UpdateEventDto extends CreateEventDto {}

export class EventRadarQueryDto {
  @ApiPropertyOptional({ example: 9.9658 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 76.2441 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 15, description: 'Search radius in kilometers' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  radius_km?: number;

  @ApiPropertyOptional({ enum: EventFormat })
  @IsOptional()
  @IsEnum(EventFormat)
  format?: EventFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Ernakulam' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
