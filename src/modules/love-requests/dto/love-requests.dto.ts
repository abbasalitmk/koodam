import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendLoveRequestDto {
  @ApiProperty({ description: 'User ID of the recipient' })
  @IsUUID()
  receiverId!: string;

  @ApiPropertyOptional({
    example: 'Saw you at the Fort Kochi sunset jam — would love to grab a Sulaimani together!',
    maxLength: 140,
    description: 'Intentional contextual note (max 140 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;

  @ApiPropertyOptional({ description: 'Optional event where you saw/met each other' })
  @IsOptional()
  @IsUUID()
  sharedEventId?: string;
}
