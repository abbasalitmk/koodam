import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, RelationshipIntention } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, Min } from 'class-validator';

export class DatingDiscoverQueryDto {
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

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: RelationshipIntention })
  @IsOptional()
  @IsEnum(RelationshipIntention)
  intention?: RelationshipIntention;

  @ApiPropertyOptional({ example: 'Ernakulam', description: 'Filter by Kerala home district / roots' })
  @IsOptional()
  @IsString()
  homeDistrict?: string;

  @ApiPropertyOptional({ example: 9.9312 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 76.2673 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 30, description: 'Search radius in kilometers' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  radiusKm?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
