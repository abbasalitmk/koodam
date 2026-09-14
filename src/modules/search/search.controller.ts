import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';
import { CurrentUser, Public, ThrottleSearch } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Search')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @ThrottleSearch()
  @Get()
  @ApiOperation({ summary: 'Unified search across gatherings, people, locations and interests' })
  search(
    @CurrentUser('id') userId: string | undefined,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(userId, query);
  }
}
