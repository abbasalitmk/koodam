import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectionOrigin } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateConnectionDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsUUID()
  targetUserId!: string;

  @ApiPropertyOptional({ enum: ConnectionOrigin, default: ConnectionOrigin.CONNECT_FRIEND })
  @IsOptional()
  @IsEnum(ConnectionOrigin)
  origin?: ConnectionOrigin;

  @ApiPropertyOptional({ description: 'Shared event ID where connection originated' })
  @IsOptional()
  @IsUUID()
  sharedEventId?: string;
}
