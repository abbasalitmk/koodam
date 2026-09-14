import { ApiPropertyOptional } from '@nestjs/swagger';
import { MessagePermission } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {
  @ApiPropertyOptional({
    description:
      'Private Mode. Hides the account from People Discovery, the People Map and dating ' +
      'discovery. Event participation still works according to each event’s own privacy.',
  })
  @IsOptional()
  @IsBoolean()
  privateMode?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInDiscover?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnPeopleMap?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showDistance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showOnlineStatus?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showLocation?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowLoveRequests?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() readReceipts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() datingVisible?: boolean;

  @ApiPropertyOptional({ enum: MessagePermission })
  @IsOptional()
  @IsEnum(MessagePermission)
  allowMessages?: MessagePermission;
}
