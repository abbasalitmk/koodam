import { Module } from '@nestjs/common';
import { LoveRequestsController } from './love-requests.controller';
import { LoveRequestsService } from './love-requests.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LoveRequestsController],
  providers: [LoveRequestsService],
  exports: [LoveRequestsService],
})
export class LoveRequestsModule {}
