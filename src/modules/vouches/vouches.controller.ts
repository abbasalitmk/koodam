import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VouchesService } from './vouches.service';
import { SubmitVouchDto, VouchByTokenDto } from './dto/vouches.dto';
import { CurrentUser, Public, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Vouches')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'vouches', version: '1' })
export class VouchesController {
  constructor(private readonly vouches: VouchesService) {}

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a peer endorsement for a gathering (3 verified vouches publish the event)',
  })
  submitVouch(@CurrentUser('id') voucherId: string, @Body() dto: SubmitVouchDto) {
    return this.vouches.submitVouch(voucherId, dto);
  }

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vouch via WhatsApp / deep link token' })
  submitVouchByToken(@CurrentUser('id') voucherId: string, @Body() dto: VouchByTokenDto) {
    return this.vouches.submitVouchByToken(voucherId, dto);
  }

  @Public()
  @Get('token/:vouchToken')
  @ApiOperation({ summary: 'Preview gathering details from a shared vouch link' })
  getVouchTokenPreview(@Param('vouchToken') token: string) {
    return this.vouches.getVouchTokenPreview(token);
  }

  @Public()
  @Get('event/:eventId')
  @ApiOperation({ summary: 'List verified peer vouches for an event' })
  listVouchesForEvent(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.vouches.listVouchesForEvent(eventId);
  }
}
