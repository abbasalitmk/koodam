import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignPlan, CampaignStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';

const FEATURED_PLANS = [
  {
    plan: CampaignPlan.ONE_DAY,
    name: '1 Day Spotlight',
    durationDays: 1,
    priceInr: 299,
    description: 'Boost gathering to top of radar and feed for 24 hours prior to meetup.',
  },
  {
    plan: CampaignPlan.SEVEN_DAYS,
    name: '7 Days Regional Featured',
    durationDays: 7,
    priceInr: 999,
    description: 'Premier pin on Map Radar and top card carousel across all 14 districts for 1 week.',
  },
  {
    plan: CampaignPlan.THIRTY_DAYS,
    name: '30 Days Festival Tier',
    durationDays: 30,
    priceInr: 2499,
    description: 'Month-long prominent discovery for curated cultural festivals and large community summits.',
  },
];

@Injectable()
export class FeaturedEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  getPlans() {
    return FEATURED_PLANS;
  }

  async createCampaign(userId: string, eventId: string, plan: CampaignPlan) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizerId: userId },
    });
    if (!event) throw new NotFoundException('Event not found or not owned by user.');

    const selectedPlan = FEATURED_PLANS.find((p) => p.plan === plan);
    if (!selectedPlan) throw new BadRequestException('Invalid featured campaign plan.');

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + selectedPlan.durationDays * 24 * 60 * 60 * 1000);

    const campaign = await this.prisma.featuredEventCampaign.create({
      data: {
        eventId,
        organizerId: userId,
        plan,
        amount: selectedPlan.priceInr,
        currency: 'INR',
        startAt,
        endAt,
        status: CampaignStatus.PENDING_PAYMENT,
      },
    });

    const paymentOrder = await this.paymentsService.createPayment({
      userId,
      eventId,
      campaignId: campaign.id,
      amount: selectedPlan.priceInr,
      currency: 'INR',
    });

    return {
      campaign,
      paymentOrder,
    };
  }

  async getMyCampaigns(userId: string) {
    return this.prisma.featuredEventCampaign.findMany({
      where: { organizerId: userId },
      include: {
        event: { select: { id: true, title: true, isFeatured: true, featuredUntil: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
