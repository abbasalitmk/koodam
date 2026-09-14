import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto, EventRadarQueryDto, UpdateEventDto } from './dto/events.dto';
import { CurrentUser, Public, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Events')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List all event categories' })
  getCategories() {
    return this.events.listCategories();
  }

  @Public()
  @Get('radar')
  @ApiOperation({ summary: 'Live spatial radar map & list query for gatherings within radius' })
  getRadarEvents(@Query() query: EventRadarQueryDto) {
    return this.events.getRadarEvents(query);
  }

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post()
  @ApiOperation({
    summary: 'Create a gathering (Strict Single-Day Policy, Max 8 hours, 50:50 gender balance)',
  })
  createEvent(@CurrentUser('id') userId: string, @Body() dto: CreateEventDto) {
    return this.events.createEvent(userId, dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get single event details with vouches and attendee preview' })
  getEventById(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.events.getEventById(eventId, currentUserId);
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing event (organizer only)' })
  updateEvent(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.updateEvent(eventId, userId, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an event' })
  cancelEvent(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.events.cancelEvent(eventId, userId);
  }
}
