import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventAttendeesService } from './event-attendees.service';
import { CheckInPassDto, JoinEventDto } from './dto/attendees.dto';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Event Attendees')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'events', version: '1' })
export class EventAttendeesController {
  constructor(private readonly attendees: EventAttendeesService) {}

  @ThrottleWrite()
  @Post(':id/join')
  @ApiOperation({ summary: 'RSVP / Join gathering with atomic 50:50 gender balance lock & QR pass' })
  joinEvent(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: JoinEventDto,
  ) {
    return this.attendees.joinEvent(userId, eventId, dto);
  }

  @Delete(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel attendance reservation' })
  leaveEvent(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) eventId: string) {
    return this.attendees.leaveEvent(userId, eventId);
  }

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bookmark / Save gathering to My Events' })
  saveEvent(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) eventId: string) {
    return this.attendees.saveEvent(userId, eventId);
  }

  @Delete(':id/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove gathering from saved list' })
  unsaveEvent(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) eventId: string) {
    return this.attendees.unsaveEvent(userId, eventId);
  }

  @Get(':id/people')
  @ApiOperation({ summary: 'Discover fellow confirmed attendees (respects privacy & blocks)' })
  getAttendees(
    @CurrentUser('id') viewerId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.attendees.getAttendees(eventId, viewerId);
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Scan & verify an attendee QR pass code (Organizer only)' })
  checkIn(
    @CurrentUser('id') organizerId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CheckInPassDto,
  ) {
    return this.attendees.checkInAttendee(organizerId, eventId, dto);
  }

  @Get('me/attending')
  @ApiOperation({ summary: 'List gatherings current user is attending with QR pass codes' })
  getMyAttending(@CurrentUser('id') userId: string) {
    return this.attendees.getMyAttending(userId);
  }

  @Get('me/hosting')
  @ApiOperation({ summary: 'List gatherings current user is hosting' })
  getMyHosting(@CurrentUser('id') userId: string) {
    return this.attendees.getMyHosting(userId);
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'List saved / bookmarked gatherings' })
  getMySaved(@CurrentUser('id') userId: string) {
    return this.attendees.getMySaved(userId);
  }
}
