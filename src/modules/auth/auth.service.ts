import { Injectable, Logger } from '@nestjs/common';
import { OtpPurpose, User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/utils/app.exception';
import { ErrorCode } from '../../common/utils/error-codes';
import { TokenService } from './services/token.service';
import { OtpService } from './services/otp.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AuthSessionDto, AuthUserDto, OtpChallengeDto } from './dto/auth-response.dto';

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthSessionDto> {
    const email = dto.email?.toLowerCase();
    const phone = dto.phone;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      select: { id: true },
    });
    if (existing) {
      throw AppException.conflict(
        ErrorCode.CONFLICT,
        'An account already exists for that email or phone number',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash: await argon2.hash(dto.password, ARGON_OPTIONS),
        privacySettings: { create: {} },
        preferences: { create: {} },
      },
      select: { id: true, email: true, phone: true, role: true, isVerified: true },
    });

    // The profile itself is created by the onboarding wizard (POST /profiles/me),
    // which needs date of birth and gender that registration does not collect.
    this.logger.log(`New account ${user.id}`);

    const tokens = await this.tokens.issuePair(
      { id: user.id, role: user.role, isVerified: user.isVerified },
      ctx,
    );

    return {
      user: { ...user, isProfileComplete: false },
      tokens,
    };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthSessionDto> {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        status: true,
        passwordHash: true,
        suspendedUntil: true,
        profile: { select: { isProfileComplete: true } },
      },
    });

    // Always run a verification so response timing does not reveal account existence.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const valid = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !valid) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Incorrect email/phone or password',
        401,
      );
    }

    this.assertUsable(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const tokens = await this.tokens.issuePair(user, ctx);

    return {
      user: this.toAuthUser(user, user.profile?.isProfileComplete ?? false),
      tokens,
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext) {
    const { tokens } = await this.tokens.rotate(refreshToken, ctx);
    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<{ loggedOut: true }> {
    if (refreshToken) await this.tokens.revokeToken(refreshToken);
    else await this.tokens.revokeAllForUser(userId);
    return { loggedOut: true };
  }

  async requestOtp(dto: RequestOtpDto): Promise<OtpChallengeDto> {
    const user = await this.findByIdentifier(dto.identifier);

    // Password reset for an unknown identifier returns the same shape, so the
    // endpoint cannot be used to enumerate accounts.
    if (!user && dto.purpose === OtpPurpose.PASSWORD_RESET) {
      return {
        message: `If an account exists, a code has been sent to ${this.otp.mask(dto.identifier)}`,
        expiresInSeconds: 300,
      };
    }

    const delivery = await this.otp.issue(dto.identifier, dto.purpose, user?.id);
    return {
      message: `A verification code has been sent to ${this.otp.mask(dto.identifier)}`,
      expiresInSeconds: delivery.expiresInSeconds,
      ...(delivery.devCode ? { devCode: delivery.devCode } : {}),
    };
  }

  /**
   * Verifies an OTP. For LOGIN it returns a session; for PHONE/EMAIL
   * verification it stamps the account as verified.
   */
  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<AuthSessionDto | { verified: true }> {
    const userId = await this.otp.verify(dto.identifier, dto.purpose, dto.code);

    if (dto.purpose === OtpPurpose.PASSWORD_RESET) {
      return { verified: true };
    }

    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isVerified: true,
            status: true,
            suspendedUntil: true,
            profile: { select: { isProfileComplete: true } },
          },
        })
      : await this.findByIdentifier(dto.identifier);

    if (!user) {
      throw AppException.notFound('Account', ErrorCode.NOT_FOUND);
    }
    this.assertUsable(user);

    const verifiedField =
      dto.purpose === OtpPurpose.PHONE_VERIFICATION
        ? { phoneVerifiedAt: new Date() }
        : dto.purpose === OtpPurpose.EMAIL_VERIFICATION
          ? { emailVerifiedAt: new Date() }
          : {};

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...verifiedField, isVerified: true, lastActiveAt: new Date() },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        profile: { select: { isProfileComplete: true } },
      },
    });

    const tokens = await this.tokens.issuePair(updated, ctx);
    return {
      user: this.toAuthUser(updated, updated.profile?.isProfileComplete ?? false),
      tokens,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<OtpChallengeDto> {
    return this.requestOtp({ identifier: dto.identifier, purpose: OtpPurpose.PASSWORD_RESET });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const userId = await this.otp.verify(
      dto.identifier,
      OtpPurpose.PASSWORD_RESET,
      dto.code,
    );

    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      : await this.findByIdentifier(dto.identifier);

    if (!user) throw AppException.notFound('Account', ErrorCode.NOT_FOUND);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(dto.newPassword, ARGON_OPTIONS) },
    });

    // A password reset invalidates every existing session.
    await this.tokens.revokeAllForUser(user.id);
    return { reset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const valid = user.passwordHash
      ? await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false)
      : false;

    if (!valid) {
      throw new AppException(ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect', 401);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword, ARGON_OPTIONS) },
    });
    await this.tokens.revokeAllForUser(userId);
    return { changed: true };
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        profile: { select: { isProfileComplete: true } },
      },
    });
    return this.toAuthUser(user, user.profile?.isProfileComplete ?? false);
  }

  private toAuthUser(
    user: Pick<User, 'id' | 'email' | 'phone' | 'role' | 'isVerified'>,
    isProfileComplete: boolean,
  ): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      isProfileComplete,
    };
  }

  private assertUsable(user: { status: UserStatus; suspendedUntil?: Date | null }): void {
    if (user.status === UserStatus.SUSPENDED) {
      const until = user.suspendedUntil
        ? ` until ${user.suspendedUntil.toISOString().slice(0, 10)}`
        : '';
      throw new AppException(
        ErrorCode.ACCOUNT_SUSPENDED,
        `This account is suspended${until}. Contact support@koodam.app.`,
        403,
      );
    }
    if (user.status === UserStatus.DELETED || user.status === UserStatus.DEACTIVATED) {
      throw new AppException(ErrorCode.ACCOUNT_SUSPENDED, 'This account is no longer active', 403);
    }
  }

  private async findByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        status: true,
        suspendedUntil: true,
        profile: { select: { isProfileComplete: true } },
      },
    });
  }

  /** Constant-work stand-in so failed lookups cost the same as real verifies. */
  private dummyHashCache?: string;
  private async dummyHash(): Promise<string> {
    if (!this.dummyHashCache) {
      this.dummyHashCache = await argon2.hash('koodam-timing-equaliser', ARGON_OPTIONS);
    }
    return this.dummyHashCache;
  }
}
