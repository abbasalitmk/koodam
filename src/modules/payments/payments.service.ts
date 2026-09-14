import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export interface CreateOrderParams {
  userId: string;
  eventId?: string;
  campaignId?: string;
  amount: number;
  currency?: string;
}

export interface VerifyPaymentParams {
  paymentId: string;
  providerPaymentId: string;
  signature?: string;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<{ orderId: string; amount: number; currency: string }>;
  verify(params: VerifyPaymentParams): Promise<boolean>;
}

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(params: CreateOrderParams) {
    return {
      orderId: `order_mock_${randomBytes(8).toString('hex')}`,
      amount: params.amount,
      currency: params.currency ?? 'INR',
    };
  }

  async verify(params: VerifyPaymentParams): Promise<boolean> {
    return Boolean(params.providerPaymentId && params.paymentId);
  }
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: MockPaymentProvider,
  ) {}

  async createPayment(params: CreateOrderParams) {
    const order = await this.provider.createOrder(params);

    const payment = await this.prisma.payment.create({
      data: {
        userId: params.userId,
        eventId: params.eventId,
        campaignId: params.campaignId,
        provider: 'mock',
        providerPaymentId: order.orderId,
        amount: params.amount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
    };
  }

  async verifyPayment(userId: string, params: VerifyPaymentParams) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: params.paymentId },
    });
    if (!payment || payment.userId !== userId) {
      throw new Error('Payment not found');
    }

    const verified = await this.provider.verify(params);
    if (!verified) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      return { success: false, message: 'Payment verification failed' };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          providerPaymentId: params.providerPaymentId,
        },
      });

      // If associated with a campaign, activate it!
      if (payment.campaignId) {
        const campaign = await tx.featuredEventCampaign.findUnique({
          where: { id: payment.campaignId },
        });

        if (campaign) {
          await tx.featuredEventCampaign.update({
            where: { id: campaign.id },
            data: { status: 'ACTIVE' },
          });

          await tx.event.update({
            where: { id: campaign.eventId },
            data: {
              isFeatured: true,
              featuredUntil: campaign.endAt,
            },
          });
        }
      }

      return p;
    });

    return { success: true, payment: updated };
  }

  async listMyPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
