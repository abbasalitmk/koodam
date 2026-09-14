import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ description: 'False until the onboarding wizard has been completed' })
  isProfileComplete!: boolean;
}

export class AuthSessionDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;
}

export class OtpChallengeDto {
  @ApiProperty({ example: 'An OTP has been sent to +91••••••2345' })
  message!: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;

  @ApiPropertyOptional({
    description: 'Only populated when OTP_PROVIDER=console, for local development',
  })
  devCode?: string;
}
