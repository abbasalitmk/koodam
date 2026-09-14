import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatingService } from './dating.service';
import { DatingDiscoverQueryDto } from './dto/dating.dto';
import { CurrentUser } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Dating')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'dating', version: '1' })
export class DatingController {
  constructor(private readonly dating: DatingService) {}

  @Get('discover')
  @ApiOperation({
    summary: 'Discover dating matches scored by location, intentions, shared interests & verification',
  })
  discover(
    @CurrentUser('id') userId: string,
    @Query() query: DatingDiscoverQueryDto,
  ) {
    return this.dating.discover(userId, query);
  }
}
