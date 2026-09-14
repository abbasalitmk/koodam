import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventStatus, UserRole, UserStatus, VerificationStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { ReportsService } from '../reports/reports.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ModerateEventDto {
  @IsEnum(EventStatus)
  status!: EventStatus;

  @IsOptional()
  @IsString()
  moderationNote?: string;
}

class ReviewVerificationDto {
  @IsEnum(VerificationStatus)
  status!: VerificationStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiResponse({ status: 403, type: ApiErrorResponse })
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly reports: ReportsService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Admin: List users with role, verification and status' })
  listUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.listUsers(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Suspend, restore or deactivate a user account' })
  updateUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.updateUserStatus(adminId, targetUserId, dto.status, dto.reason);
  }

  @Get('events')
  @ApiOperation({ summary: 'Admin: List all events across moderation states' })
  listEvents(
    @Query('status') status?: EventStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.admin.listEvents(status, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Put('events/:id/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Approve, reject or flag an event' })
  moderateEvent(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: ModerateEventDto,
  ) {
    return this.admin.moderateEvent(adminId, eventId, dto.status, dto.moderationNote);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Admin: View pending community safety reports' })
  listReports(@Query('limit') limit?: number) {
    return this.reports.listReports(limit ? Number(limit) : 50);
  }

  @Get('verification-requests')
  @ApiOperation({ summary: 'Admin: List pending blue tick verification requests' })
  listVerifications() {
    return this.admin.listVerificationRequests();
  }

  @Put('verification-requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Approve or reject verification request' })
  reviewVerification(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.admin.reviewVerification(adminId, requestId, dto.status, dto.rejectionReason);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Admin: Inspect immutable security audit log trail' })
  listAuditLogs(@Query('limit') limit?: number) {
    return this.admin.listAuditLogs(limit ? Number(limit) : 100);
  }
}
