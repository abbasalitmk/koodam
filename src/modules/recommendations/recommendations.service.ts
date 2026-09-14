import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { DatingService } from '../dating/dating.service';
import { EventsService } from '../events/events.service';

export interface RecommendationProvider {
  recommendEvents(userId: string, limit?: number): Promise<any[]>;
  recommendPeople(userId: string, limit?: number): Promise<any[]>;
}

@Injectable()
export class RuleBasedRecommendationProvider implements RecommendationProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profilesService: ProfilesService,
    private readonly datingService: DatingService,
    private readonly eventsService: EventsService,
  ) {}

  async recommendEvents(userId: string, limit = 10) {
    const origin = await this.profilesService.resolveSearchOrigin(userId);
    const events = await this.eventsService.getRadarEvents({
      lat: origin?.point.latitude ?? 9.9312,
      lng: origin?.point.longitude ?? 76.2673,
      radius_km: 40,
      limit,
    });
    return events;
  }

  async recommendPeople(userId: string, limit = 10) {
    return this.datingService.discover(userId, { limit });
  }
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly provider: RuleBasedRecommendationProvider) {}

  getRecommendedEvents(userId: string, limit?: number) {
    return this.provider.recommendEvents(userId, limit);
  }

  getRecommendedPeople(userId: string, limit?: number) {
    return this.provider.recommendPeople(userId, limit);
  }
}
