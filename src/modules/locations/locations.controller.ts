import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { LocationSearchQueryDto, NearbyLocationsDto } from './dto/locations.dto';
import { Public } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Locations')
@Public()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('districts')
  @ApiOperation({ summary: 'List all 14 Kerala districts with top cities/towns' })
  getKeralaDistricts() {
    return this.locations.getKeralaDistricts();
  }

  @Get('diaspora')
  @ApiOperation({ summary: 'List global Malayali diaspora hubs (Dubai, London, Singapore, etc.)' })
  getDiasporaHubs() {
    return this.locations.getDiasporaHubs();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search locations by text query, district, or region' })
  search(@Query() query: LocationSearchQueryDto) {
    return this.locations.search(query);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to location hierarchy' })
  reverseGeocode(@Query() query: NearbyLocationsDto) {
    return this.locations.reverseGeocode(query.latitude, query.longitude);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location details with parent hierarchy and child areas' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.locations.getById(id);
  }
}
