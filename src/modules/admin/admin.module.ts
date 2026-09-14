import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportsModule } from '../reports/reports.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, ReportsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
