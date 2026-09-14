import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportReason, ReportStatus, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export class SubmitReportDto {
  targetType!: ReportTargetType;
  reportedUserId?: string;
  eventId?: string;
  messageId?: string;
  photoId?: string;
  reason!: ReportReason;
  description?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitReport(reporterId: string, dto: SubmitReportDto) {
    if (dto.reportedUserId && reporterId === dto.reportedUserId) {
      throw new BadRequestException('You cannot report your own profile.');
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        reportedUserId: dto.reportedUserId,
        eventId: dto.eventId,
        messageId: dto.messageId,
        photoId: dto.photoId,
        reason: dto.reason,
        description: dto.description,
        status: ReportStatus.PENDING,
      },
    });
  }

  async listReports(limit = 50) {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        reporter: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
      },
    });
  }

  async resolveReport(reportId: string, status: ReportStatus, note?: string) {
    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });
  }
}
