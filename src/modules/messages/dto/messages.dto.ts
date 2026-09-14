import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Max, Min } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hey! Are you heading to the Fort Kochi jam this Saturday?' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isIcebreaker?: boolean;
}

export class CreateDirectConversationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsUUID()
  targetUserId!: string;
}

export class MessagePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor (message UUID) for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
