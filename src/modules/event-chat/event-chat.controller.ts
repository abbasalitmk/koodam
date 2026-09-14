import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventChatService } from './event-chat.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { IsNotEmpty, IsString } from 'class-validator';

class PostAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

@ApiTags('Event Chat')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'events', version: '1' })
export class EventChatController {
  constructor(private readonly eventChat: EventChatService) {}

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get event community chat room details and active participants' })
  getEventChat(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventChat.getEventConversation(userId, eventId);
  }

  @ThrottleWrite()
  @Post(':id/chat/announcement')
  @ApiOperation({ summary: 'Post official announcement to event attendees (Organizer only)' })
  postAnnouncement(
    @CurrentUser('id') organizerId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: PostAnnouncementDto,
  ) {
    return this.eventChat.postAnnouncement(organizerId, eventId, dto.content);
  }
}
