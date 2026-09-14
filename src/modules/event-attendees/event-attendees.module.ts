import { Module } from '@nestjs/common';
import { EventAttendeesController } from './event-attendees.controller';
import { EventAttendeesService } from './event-attendees.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EventAttendeesController],
  providers: [EventAttendeesService],
  exports: [EventAttendeesService],
})
export class EventAttendeesModule {}
