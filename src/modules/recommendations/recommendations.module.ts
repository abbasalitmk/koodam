import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService, RuleBasedRecommendationProvider } from './recommendations.service';
import { ProfilesModule } from '../profiles/profiles.module';
import { DatingModule } from '../dating/dating.module';
import { EventsModule } from '../events/events.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, ProfilesModule, DatingModule, EventsModule],
  controllers: [RecommendationsController],
  providers: [RuleBasedRecommendationProvider, RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
