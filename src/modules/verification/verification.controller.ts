import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestVerificationDto, VerificationService } from './verification.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { VerificationKind } from '@prisma/client';
import { IsEnum, IsOptional, IsUrl } from 'class-validator';

class CreateVerificationRequestDto implements RequestVerificationDto {
  @IsEnum(VerificationKind)
  kind!: VerificationKind;

  @IsOptional()
  @IsUrl()
  documentUrl?: string;

  @IsOptional()
  @IsUrl()
  selfieUrl?: string;
}

@ApiTags('Verification')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'verification', version: '1' })
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current user identity/selfie verification status' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.verification.getMyVerificationStatus(userId);
  }

  @ThrottleWrite()
  @Post('request')
  @ApiOperation({ summary: 'Submit selfie or identity document for Blue Tick verification badge' })
  submitRequest(@CurrentUser('id') userId: string, @Body() dto: CreateVerificationRequestDto) {
    return this.verification.submitVerificationRequest(userId, dto);
  }
}
