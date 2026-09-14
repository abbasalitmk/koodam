import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AddPhotoDto {
  @ApiProperty({ example: 'https://storage.koodam.app/media/photos/devika-1.jpg' })
  @IsUrl()
  url!: string;

  @ApiProperty({ example: 'photos/devika-1.jpg' })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;
}

export class PhotoOrderItemDto {
  @ApiProperty()
  @IsUUID()
  photoId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderPhotosDto {
  @ApiProperty({ type: [PhotoOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  order!: PhotoOrderItemDto[];
}

export class RegisterDeviceTokenDto {
  @ApiProperty({ example: 'fcm_token_string_here' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({ example: 'Moving abroad / not using the app' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
