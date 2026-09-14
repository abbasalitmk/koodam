import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class JoinEventDto {
  @ApiPropertyOptional({ default: true, description: 'Whether the attendee is open to friend connections at the meetup' })
  @IsOptional()
  @IsBoolean()
  openToConnect?: boolean;
}

export class CheckInPassDto {
  @ApiPropertyOptional({ example: 'KD-8492', description: 'Unique QR Pass code' })
  @IsString()
  @IsNotEmpty()
  qrPassCode!: string;
}
