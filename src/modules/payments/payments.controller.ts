import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

class CreatePaymentOrderDto {
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

class VerifyPaymentDto {
  @IsUUID()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  providerPaymentId!: string;

  @IsOptional()
  @IsString()
  signature?: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ThrottleWrite()
  @Post('order')
  @ApiOperation({ summary: 'Initiate payment order for featured gathering promotion or tickets' })
  createOrder(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentOrderDto) {
    return this.payments.createPayment({
      userId,
      amount: dto.amount,
      eventId: dto.eventId,
      campaignId: dto.campaignId,
    });
  }

  @ThrottleWrite()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Server-side verification of payment gateway confirmation' })
  verify(@CurrentUser('id') userId: string, @Body() dto: VerifyPaymentDto) {
    return this.payments.verifyPayment(userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'List user payment transaction history' })
  getMyPayments(@CurrentUser('id') userId: string) {
    return this.payments.listMyPayments(userId);
  }
}
