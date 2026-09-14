import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitVouchDto {
  @ApiProperty({ description: 'UUID of event to vouch for' })
  @IsUUID()
  eventId!: string;

  @ApiPropertyOptional({ example: 'Attended their indie screening last month in Kozhikode, highly recommended!' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class VouchByTokenDto {
  @ApiProperty({ example: 'kd_vouch_a3f89...' })
  @IsString()
  @IsNotEmpty()
  vouchToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
