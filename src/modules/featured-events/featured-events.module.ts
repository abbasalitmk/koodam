import { Module } from '@nestjs/common';
import { FeaturedEventsController } from './featured-events.controller';
import { FeaturedEventsService } from './featured-events.service';
import { PaymentsModule } from '../payments/payments.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, PaymentsModule],
  controllers: [FeaturedEventsController],
  providers: [FeaturedEventsService],
  exports: [FeaturedEventsService],
})
export class FeaturedEventsModule {}
