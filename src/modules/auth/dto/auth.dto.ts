import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Gender, OtpPurpose, RelationshipIntention } from '@prisma/client';

/** E.164, which is what the Flutter client sends after country-code selection. */
const E164 = /^\+[1-9]\d{7,14}$/;

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'devika@koodam.app', description: 'Valid email address' })
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '+919847012345', description: 'Mobile phone number in international format (+91...)' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @ApiProperty({ minLength: 8, example: 'Koodam@2026', description: 'Password (min 8 chars, 1 letter, 1 number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password!: string;

  @ApiProperty({ example: 'Devika Suresh', description: 'User full display name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ enum: Gender, example: Gender.FEMALE, description: 'Gender identity' })
  @IsEnum(Gender, { message: 'Gender must be FEMALE, MALE, NON_BINARY, OTHER, or PREFER_NOT_TO_SAY' })
  @IsNotEmpty()
  gender!: Gender;

  @ApiProperty({ example: '1998-05-14', description: 'Date of Birth (YYYY-MM-DD), must be 18+' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string (YYYY-MM-DD)' })
  @IsNotEmpty()
  dob!: string;

  @ApiProperty({ example: 'KL-EKM', description: 'Current Kerala district code or name' })
  @IsString()
  @IsNotEmpty({ message: 'District is required' })
  district!: string;

  @ApiProperty({ example: 9.9816, description: 'Latitude selected from Map Pin Selector' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 76.2999, description: 'Longitude selected from Map Pin Selector' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    description: 'Primary profile photo URL',
  })
  @IsString()
  @IsNotEmpty({ message: 'Profile photo is required' })
  profilePhoto!: string;

  @ApiPropertyOptional({
    example: 'Architect from Fort Kochi • Passionate about heritage walks, literature and chai.',
    description: 'Short profile biography (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string;

  @ApiPropertyOptional({
    example: ['Heritage & Culture', 'Chai Meetups', 'Trekking', 'Indie Tech'],
    description: 'List of interest tags (optional)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ example: 'Architect', description: 'Profession or occupation (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ example: 'KL-KKD', description: 'Native home district in Kerala (optional)' })
  @IsOptional()
  @IsString()
  homeDistrict?: string;

  @ApiPropertyOptional({
    enum: RelationshipIntention,
    default: RelationshipIntention.OPEN_TO_CONNECTIONS,
    description: 'What the user is looking for (optional)',
  })
  @IsOptional()
  @IsEnum(RelationshipIntention)
  relationshipIntention?: RelationshipIntention;

  @ApiPropertyOptional({ example: ['Malayalam', 'English'], description: 'Languages spoken (optional)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}

export class LoginDto {
  @ApiPropertyOptional({ description: 'Email address', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Email address or username', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiProperty({ example: 'Koodam@2026', description: 'Account password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Valid refresh token string' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class RequestOtpDto {
  @ApiPropertyOptional({ description: 'Email address for OTP delivery', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Email address or identifier', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;

  @ApiPropertyOptional({ enum: ['email', 'whatsapp', 'sms'], default: 'email' })
  @IsOptional()
  @IsString()
  channel?: 'email' | 'whatsapp' | 'sms';
}

export class VerifyOtpDto {
  @ApiPropertyOptional({ description: 'Email address', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Email address or identifier', example: 'devika@koodam.app' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiProperty({ example: '482910', description: '6-digit OTP code' })
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'OTP must be 4–8 digits' })
  code!: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
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
