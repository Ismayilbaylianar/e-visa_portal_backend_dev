import { Module } from '@nestjs/common';
import { PaymentTransactionsService } from './payment-transactions.service';

@Module({
  providers: [PaymentTransactionsService],
  exports: [PaymentTransactionsService],
})
export class PaymentTransactionsModule {}
