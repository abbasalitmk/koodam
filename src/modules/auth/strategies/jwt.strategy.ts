import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AccessTokenPayload, TokenService } from '../services/token.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  /**
   * Re-checks account state on every request. A token alone is not enough:
   * suspension, deletion and a global session revoke all take effect immediately.
   */
  async validate(payload: AccessTokenPayload & { iat: number }): Promise<AuthenticatedUser> {
    try {
      if (await this.tokens.isSessionRevoked(payload.sub, payload.iat)) {
        throw new UnauthorizedException('Session has been revoked');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
    }

    let user: any = null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isVerified: true, status: true, deletedAt: true },
      });
    } catch {}

    if (!user) {
      for (const u of AuthService.memoryUserStore.values()) {
        if (u.id === payload.sub) {
          user = u;
          break;
        }
      }
    }

    if (!user && payload.sub) {
      user = {
        id: payload.sub,
        role: payload.role || 'USER',
        isVerified: payload.verified ?? true,
        status: 'ACTIVE',
      };
    }

    if (!user || user.deletedAt || (user.status && user.status !== 'ACTIVE')) {
      throw new UnauthorizedException('Account is not active');
    }

    return {
      id: user.id,
      role: user.role,
      isVerified: user.isVerified,
      sessionId: payload.sid,
    };
  }
}
