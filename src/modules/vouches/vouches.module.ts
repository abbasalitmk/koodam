import { Module } from '@nestjs/common';
import { VouchesController } from './vouches.controller';
import { VouchesService } from './vouches.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VouchesController],
  providers: [VouchesService],
  exports: [VouchesService],
})
export class VouchesModule {}
