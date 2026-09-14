import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { MockPaymentProvider, PaymentsService } from './payments.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController],
  providers: [MockPaymentProvider, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
