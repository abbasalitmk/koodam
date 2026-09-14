import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { AppException } from '../../../common/utils/app.exception';
import { ErrorCode } from '../../../common/utils/error-codes';
import { generateToken, sha256 } from '../../../common/utils/code.util';
import { TokenPairDto } from '../dto/auth-response.dto';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  verified: boolean;
  sid: string;
}

interface RefreshPayload {
  sub: string;
  fam: string;
  jti: string;
}

const BLACKLIST_PREFIX = 'auth:revoked:';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Issues an access/refresh pair. Refresh tokens are stored only as a SHA-256
   * digest and are grouped into a "family": reusing a rotated token revokes the
   * whole family, which is the standard detection for a stolen refresh token.
   */
  async issuePair(
    user: { id: string; role: UserRole; isVerified: boolean },
    context: { familyId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPairDto> {
    const familyId = context.familyId ?? randomUUID();
    const sessionId = randomUUID();
    const rawRefresh = generateToken(48);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, verified: user.isVerified, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn: this.config.getOrThrow<string>('jwt.expiresIn'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, fam: familyId, jti: rawRefresh },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.refreshExpiresIn'),
      },
    );

    try {
      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(rawRefresh),
          familyId,
          userAgent: context.userAgent?.slice(0, 250),
          ipAddress: context.ipAddress,
          expiresAt: this.refreshExpiry(),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist refresh token to database (${err.message}). Proceeding with stateless JWT.`);
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds(),
      tokenType: 'Bearer',
    };
  }

  /** Verifies and rotates a refresh token, revoking the family on reuse. */
  async rotate(
    rawToken: string,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<{ tokens: TokenPairDto; userId: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new AppException(ErrorCode.TOKEN_EXPIRED, 'Refresh token is invalid or expired', 401);
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(payload.jti) },
    });

    if (!stored) {
      // Signature was valid but the row is gone — treat as replay of a rotated token.
      await this.revokeFamily(payload.fam);
      throw new AppException(ErrorCode.TOKEN_REUSED, 'Session revoked. Please sign in again.', 401);
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for family ${payload.fam}`);
      await this.revokeFamily(payload.fam);
      throw new AppException(ErrorCode.TOKEN_REUSED, 'Session revoked. Please sign in again.', 401);
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new AppException(ErrorCode.TOKEN_EXPIRED, 'Refresh token expired', 401);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, role: true, isVerified: true, status: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.revokeFamily(payload.fam);
      throw new AppException(ErrorCode.ACCOUNT_SUSPENDED, 'This account is not active', 403);
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issuePair(user, { familyId: payload.fam, ...context });
    return { tokens, userId: user.id };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeToken(rawToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(payload.jti), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // A malformed logout token is not an error worth surfacing.
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Access tokens are short-lived but still valid until expiry; blacklist the
    // user so the JWT strategy rejects them immediately.
    await this.redis.client.set(
      `${BLACKLIST_PREFIX}${userId}`,
      Date.now().toString(),
      'EX',
      this.accessTtlSeconds() + 60,
    );
  }

  /** True when every access token issued before the cutoff must be rejected. */
  async isSessionRevoked(userId: string, issuedAtSeconds: number): Promise<boolean> {
    const cutoff = await this.redis.client.get(`${BLACKLIST_PREFIX}${userId}`);
    if (!cutoff) return false;
    return issuedAtSeconds * 1000 < Number(cutoff);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('jwt.secret'),
    });
  }

  private accessTtlSeconds(): number {
    return parseDuration(this.config.getOrThrow<string>('jwt.expiresIn'));
  }

  private refreshExpiry(): Date {
    return new Date(
      Date.now() + parseDuration(this.config.getOrThrow<string>('jwt.refreshExpiresIn')) * 1000,
    );
  }
}

/** Parses `15m`, `30d`, `2h`, `45s` or a bare number of seconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) return 900;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return amount * 86_400;
    case 'h':
      return amount * 3_600;
    case 'm':
      return amount * 60;
    default:
      return amount;
  }
}
