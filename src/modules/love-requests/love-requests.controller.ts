import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoveRequestsService } from './love-requests.service';
import { SendLoveRequestDto } from './dto/love-requests.dto';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Love Requests')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'love-requests', version: '1' })
export class LoveRequestsController {
  constructor(private readonly loveRequests: LoveRequestsService) {}

  @ThrottleWrite()
  @Post()
  @ApiOperation({ summary: 'Send an intentional Love Request (with 140-char note, 48-hour TTL)' })
  sendLove(@CurrentUser('id') senderId: string, @Body() dto: SendLoveRequestDto) {
    return this.loveRequests.sendLove(senderId, dto);
  }

  @Get('received')
  @ApiOperation({ summary: 'List incoming active Love Requests' })
  getReceived(@CurrentUser('id') userId: string) {
    return this.loveRequests.getReceived(userId);
  }

  @Get('sent')
  @ApiOperation({ summary: 'List sent Love Requests' })
  getSent(@CurrentUser('id') userId: string) {
    return this.loveRequests.getSent(userId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a Love Request (creates mutual Connection + unlocks 1:1 chat)' })
  accept(
    @CurrentUser('id') receiverId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.loveRequests.accept(receiverId, requestId);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a Love Request' })
  decline(
    @CurrentUser('id') receiverId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.loveRequests.decline(receiverId, requestId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending Love Request sent by current user' })
  cancel(
    @CurrentUser('id') senderId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ) {
    return this.loveRequests.cancel(senderId, requestId);
  }
}
