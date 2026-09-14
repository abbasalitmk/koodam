import { Injectable } from '@nestjs/common';
import { VerificationKind, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export class RequestVerificationDto {
  kind!: VerificationKind;
  documentUrl?: string;
  selfieUrl?: string;
}

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async submitVerificationRequest(userId: string, dto: RequestVerificationDto) {
    return this.prisma.verificationRequest.create({
      data: {
        userId,
        kind: dto.kind,
        evidenceKey: dto.documentUrl ?? dto.selfieUrl,
        status: VerificationStatus.PENDING,
      },
    });
  }

  async getMyVerificationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, phoneVerifiedAt: true, emailVerifiedAt: true },
    });

    const requests = await this.prisma.verificationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      isVerified: user?.isVerified ?? false,
      phoneVerified: Boolean(user?.phoneVerifiedAt),
      emailVerified: Boolean(user?.emailVerifiedAt),
      recentRequests: requests,
    };
  }

  async reviewRequest(requestId: string, status: VerificationStatus, reviewerId: string, rejectionReason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNote: rejectionReason,
        },
      });

      if (status === VerificationStatus.VERIFIED) {
        await tx.user.update({
          where: { id: request.userId },
          data: { isVerified: true },
        });

        await tx.profile.updateMany({
          where: { userId: request.userId },
          data: { verification: VerificationStatus.VERIFIED },
        });
      }

      return request;
    });
  }
}
