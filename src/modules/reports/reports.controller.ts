import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReportsService, SubmitReportDto } from './reports.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { ReportReason, ReportTargetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

class CreateReportDto implements SubmitReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsOptional()
  @IsUUID()
  reportedUserId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;

  @IsOptional()
  @IsUUID()
  photoId?: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ThrottleWrite()
  @Post()
  @ApiOperation({ summary: 'Submit safety or moderation report for profile, event, photo, or message' })
  submitReport(@CurrentUser('id') userId: string, @Body() dto: CreateReportDto) {
    return this.reports.submitReport(userId, dto);
  }
}
