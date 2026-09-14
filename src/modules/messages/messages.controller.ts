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
import { MessagesService } from './messages.service';
import { CreateDirectConversationDto, MessagePaginationQueryDto, SendMessageDto } from './dto/messages.dto';
import { CurrentUser, Public, ThrottleMessage, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Messages')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'conversations', version: '1' })
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Public()
  @Get('icebreakers')
  @ApiOperation({ summary: 'Curated Malayali cultural conversation icebreakers' })
  getIcebreakers() {
    return this.messages.getIcebreakers();
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List all direct and event group conversations for current user' })
  listConversations(@CurrentUser('id') userId: string) {
    return this.messages.listConversations(userId);
  }

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post()
  @ApiOperation({ summary: 'Create or return existing direct conversation with another member' })
  createDirect(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.messages.createDirectConversation(userId, dto);
  }

  @ApiBearerAuth()
  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages in conversation with cursor pagination' })
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: MessagePaginationQueryDto,
  ) {
    return this.messages.getMessages(userId, conversationId, query);
  }

  @ApiBearerAuth()
  @ThrottleMessage()
  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message in conversation (REST fallback)' })
  sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.sendMessage(userId, conversationId, dto);
  }

  @ApiBearerAuth()
  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.messages.markAsRead(userId, conversationId);
  }

  @ApiBearerAuth()
  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message sent by user' })
  deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messages.deleteMessage(userId, messageId);
  }
}
