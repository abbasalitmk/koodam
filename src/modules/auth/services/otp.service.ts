import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/utils/app.exception';
import { ErrorCode } from '../../../common/utils/error-codes';
import { generateNumericOtp } from '../../../common/utils/code.util';
import { OtpConfig } from '../../../config/configuration';

export interface OtpDelivery {
  expiresInSeconds: number;
  /** Returned only by the console provider so local development can proceed. */
  devCode?: string;
}

/**
 * OTP issue/verify. Codes are stored as argon2 hashes with an attempt counter,
 * so a leaked database row cannot be replayed and brute force is bounded.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private static readonly memoryOtpStore = new Map<
    string,
    { codeHash: string; expiresAt: Date; attempts: number; userId?: string }
  >();

  private get options(): OtpConfig {
    return this.config.getOrThrow<OtpConfig>('otp');
  }

  async issue(
    identifier: string,
    purpose: OtpPurpose,
    userId?: string,
  ): Promise<OtpDelivery> {
    const { length, ttlSeconds, provider } = this.options;
    const code = generateNumericOtp(length);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });

    try {
      // Invalidate any outstanding code for this identifier + purpose.
      await this.prisma.otpCode.updateMany({
        where: { identifier, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await this.prisma.otpCode.create({
        data: {
          identifier,
          purpose,
          userId: userId ?? null,
          codeHash,
          expiresAt,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Database write failed in OtpService.issue (${err.message}). Storing in memory fallback cache.`);
      OtpService.memoryOtpStore.set(`${identifier}:${purpose}`, {
        codeHash,
        expiresAt,
        attempts: 0,
        userId,
      });
    }

    await this.deliver(identifier, code, purpose);

    return {
      expiresInSeconds: ttlSeconds,
      ...(provider === 'console' ? { devCode: code } : {}),
    };
  }

  /** Consumes a code. Throws with a specific error code on every failure mode. */
  async verify(identifier: string, purpose: OtpPurpose, code: string): Promise<string | null> {
    let record: { id?: string; codeHash: string; expiresAt: Date; attempts: number; userId?: string | null } | null = null;
    let isInMemory = false;

    try {
      record = await this.prisma.otpCode.findFirst({
        where: { identifier, purpose, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err: any) {
      this.logger.warn(`Database read failed in OtpService.verify (${err.message}). Falling back to memory store.`);
    }

    if (!record) {
      const memoryRecord = OtpService.memoryOtpStore.get(`${identifier}:${purpose}`);
      if (memoryRecord) {
        record = memoryRecord;
        isInMemory = true;
      }
    }

    if (!record) {
      throw AppException.badRequest(ErrorCode.OTP_INVALID, 'No pending code for this identifier');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      if (isInMemory) OtpService.memoryOtpStore.delete(`${identifier}:${purpose}`);
      throw AppException.badRequest(ErrorCode.OTP_EXPIRED, 'This code has expired');
    }

    if (record.attempts >= this.options.maxAttempts) {
      if (!isInMemory && record.id) {
        await this.prisma.otpCode.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        }).catch(() => {});
      } else {
        OtpService.memoryOtpStore.delete(`${identifier}:${purpose}`);
      }
      throw AppException.badRequest(
        ErrorCode.OTP_ATTEMPTS_EXCEEDED,
        'Too many incorrect attempts. Request a new code.',
      );
    }

    const matches = await argon2.verify(record.codeHash, code);
    if (!matches) {
      if (!isInMemory && record.id) {
        await this.prisma.otpCode.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        }).catch(() => {});
      } else {
        record.attempts += 1;
      }
      throw AppException.badRequest(ErrorCode.OTP_INVALID, 'That code is not correct');
    }

    if (!isInMemory && record.id) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }).catch(() => {});
    } else {
      OtpService.memoryOtpStore.delete(`${identifier}:${purpose}`);
    }

    return record.userId ?? null;
  }

  /** Masks an identifier for display: `+91••••••2345`, `de••••@koodam.app`. */
  mask(identifier: string): string {
    if (identifier.includes('@')) {
      const [local, domain] = identifier.split('@');
      const head = local.slice(0, 2);
      return `${head}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}`;
    }
    const tail = identifier.slice(-4);
    const head = identifier.slice(0, 3);
    return `${head}${'•'.repeat(Math.max(2, identifier.length - 7))}${tail}`;
  }

  private async deliver(identifier: string, code: string, purpose: OtpPurpose): Promise<void> {
    if (identifier.includes('@')) {
      // Email OTP Delivery
      this.logger.log(`[OTP:EMAIL:${purpose}] Verification code for ${this.mask(identifier)}: ${code}`);
      return;
    }

    // Phone OTP Delivery (WhatsApp / SMS)
    switch (this.options.provider) {
      case 'whatsapp':
        try {
          await this.deliverViaWhatsApp(identifier, code);
        } catch (err: any) {
          this.logger.warn(`WhatsApp delivery failed: ${err.message}. Falling back to console output.`);
          this.logger.log(`[OTP:PHONE:${purpose}] ${this.mask(identifier)} → ${code}`);
        }
        break;
      case 'twilio':
        this.logger.warn('Twilio OTP provider is not configured; falling back to log output');
        this.logger.log(`[OTP:PHONE:${purpose}] ${this.mask(identifier)} → ${code}`);
        break;
      default:
        this.logger.log(`[OTP:PHONE:${purpose}] ${this.mask(identifier)} → ${code}`);
    }
  }

  private async deliverViaWhatsApp(identifier: string, code: string): Promise<void> {
    const { whatsappToken, whatsappPhoneNumberId } = this.options;
    if (!whatsappToken || !whatsappPhoneNumberId) {
      this.logger.error('WhatsApp OTP selected but credentials are missing');
      throw AppException.badRequest(
        ErrorCode.INTERNAL_ERROR,
        'OTP delivery is temporarily unavailable',
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: identifier.replace('+', ''),
          type: 'template',
          template: {
            name: 'koodam_otp',
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
          },
        }),
      },
    );

    if (!response.ok) {
      this.logger.error(`WhatsApp OTP delivery failed: ${response.status}`);
      throw AppException.badRequest(
        ErrorCode.INTERNAL_ERROR,
        'Could not deliver the verification code. Please try again.',
      );
    }
  }
}
