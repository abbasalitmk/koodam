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

  @ApiProperty({ description: 'True when full profile information has been collected' })
  isProfileComplete!: boolean;

  @ApiPropertyOptional({ example: 'Devika Suresh' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'KL-EKM' })
  district?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' })
  profilePhoto?: string;
}

export class AuthSessionDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;

  @ApiPropertyOptional({ example: false, description: 'True if the user was just registered via OTP verification' })
  isNewUser?: boolean;
}

export class OtpChallengeDto {
  @ApiProperty({ example: 'An OTP has been sent to +91••••••2345' })
  message!: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;

  @ApiPropertyOptional({ example: true, description: 'Whether the account is already registered' })
  isRegistered?: boolean;

  @ApiPropertyOptional({
    description: 'Only populated when OTP_PROVIDER=console, for local development',
  })
  devCode?: string;
}
