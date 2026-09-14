import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { CurrentUser } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Recommendations')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'recommendations', version: '1' })
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get('events')
  @ApiOperation({ summary: 'Personalized event recommendations based on proximity and shared interests' })
  getEvents(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.recommendations.getRecommendedEvents(userId, limit ? Number(limit) : 10);
  }

  @Get('people')
  @ApiOperation({ summary: 'Personalized people & companion recommendations' })
  getPeople(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.recommendations.getRecommendedPeople(userId, limit ? Number(limit) : 10);
  }
}
