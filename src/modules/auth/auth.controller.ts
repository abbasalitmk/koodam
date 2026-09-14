import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AuthSessionDto, AuthUserDto, OtpChallengeDto, TokenPairDto } from './dto/auth-response.dto';
import { CurrentUser, Public, ThrottleAuth, ThrottleOtp } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Authentication')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @ThrottleAuth()
  @Post('register')
  @ApiOperation({ summary: 'Create an account with email or phone plus a password' })
  @ApiResponse({ status: 201, type: AuthSessionDto })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.context(req));
  }

  @Public()
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Exchange credentials for an access/refresh token pair' })
  @ApiResponse({ status: 200, type: AuthSessionDto })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.context(req));
  }

  @Public()
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token; reuse revokes the whole session family' })
  @ApiResponse({ status: 200, type: TokenPairDto })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.context(req));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke one session, or every session when no token is supplied' })
  logout(@CurrentUser('id') userId: string, @Body() dto: LogoutDto) {
    return this.auth.logout(userId, dto.refreshToken);
  }

  @Public()
  @ThrottleOtp()
  @HttpCode(HttpStatus.OK)
  @Post('otp/request')
  @ApiOperation({ summary: 'Send a one-time code by WhatsApp, SMS or email' })
  @ApiResponse({ status: 200, type: OtpChallengeDto })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @ThrottleOtp()
  @HttpCode(HttpStatus.OK)
  @Post('otp/send')
  @ApiOperation({ summary: 'Send a one-time code by WhatsApp, SMS or email (alias for otp/request)' })
  @ApiResponse({ status: 200, type: OtpChallengeDto })
  sendOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @ThrottleOtp()
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify a one-time code; issues a session for login flows' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto, this.context(req));
  }

  @Public()
  @ThrottleOtp()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Start a password reset; the response never reveals account existence' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @ThrottleAuth()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Complete a password reset and revoke all existing sessions' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiOperation({ summary: 'Change the password for the signed-in account' })
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Identity and onboarding state for the current token' })
  @ApiResponse({ status: 200, type: AuthUserDto })
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  private context(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
