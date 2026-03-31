import { Module } from '@nestjs/common';
import { PaymentPageConfigsController } from './payment-page-configs.controller';
import { PaymentPageConfigsService } from './payment-page-configs.service';

@Module({
  controllers: [PaymentPageConfigsController],
  providers: [PaymentPageConfigsService],
  exports: [PaymentPageConfigsService],
})
export class PaymentPageConfigsModule {}
