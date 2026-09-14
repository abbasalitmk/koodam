import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OtpPurpose } from '@prisma/client';

/** E.164, which is what the Flutter client sends after country-code selection. */
const E164 = /^\+[1-9]\d{7,14}$/;

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiPropertyOptional({ example: 'devika@example.com' })
  @ValidateIf((o: RegisterDto) => !o.phone)
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'A valid email or phone number is required' })
  email?: string;

  @ApiPropertyOptional({ example: '+919847012345' })
  @ValidateIf((o: RegisterDto) => !o.email)
  @Matches(E164, { message: 'Phone must be in international format, e.g. +919847012345' })
  phone?: string;

  @ApiProperty({ minLength: 8, example: 'Koodam@2026' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, { message: 'Password must contain a letter' })
  @Matches(/\d/, { message: 'Password must contain a number' })
  password!: string;

  @ApiProperty({ example: 'Devika S.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName!: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email address or E.164 phone number', example: 'devika@koodam.app' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: 'Koodam@2026' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class RequestOtpDto {
  @ApiProperty({ description: 'Email or E.164 phone number', example: '+919847012345' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ enum: OtpPurpose, example: OtpPurpose.PHONE_VERIFICATION })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '482910' })
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'OTP must be 4–8 digits' })
  code!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'devika@koodam.app' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: '482910' })
  @IsString()
  @Matches(/^\d{4,8}$/)
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Omit to revoke every session for this account' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
