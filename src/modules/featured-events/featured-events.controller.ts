import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeaturedEventsService } from './featured-events.service';
import { CurrentUser, Public, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { CampaignPlan } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

class CreateCampaignDto {
  @IsUUID()
  eventId!: string;

  @IsEnum(CampaignPlan)
  plan!: CampaignPlan;
}

@ApiTags('Featured Events')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'featured-events', version: '1' })
export class FeaturedEventsController {
  constructor(private readonly featured: FeaturedEventsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List available featured promotion tiers (1 Day, 7 Days, 30 Days)' })
  getPlans() {
    return this.featured.getPlans();
  }

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post('campaigns')
  @ApiOperation({ summary: 'Create featured promotion campaign for gathering' })
  createCampaign(@CurrentUser('id') userId: string, @Body() dto: CreateCampaignDto) {
    return this.featured.createCampaign(userId, dto.eventId, dto.plan);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'List current user featured campaigns' })
  getMyCampaigns(@CurrentUser('id') userId: string) {
    return this.featured.getMyCampaigns(userId);
  }
}
