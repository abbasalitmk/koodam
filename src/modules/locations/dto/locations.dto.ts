import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationKind } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, Min } from 'class-validator';

export class LocationSearchQueryDto {
  @ApiPropertyOptional({ example: 'Kochi' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: LocationKind })
  @IsOptional()
  @IsEnum(LocationKind)
  kind?: LocationKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isKerala?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDiaspora?: boolean;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class NearbyLocationsDto {
  @ApiPropertyOptional({ example: 9.9312 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiPropertyOptional({ example: 76.2673 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  radiusKm?: number;
}
