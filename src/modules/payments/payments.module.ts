import { Module } from '@nestjs/common';
import {
  PaymentsAdminController,
  PaymentsPortalController,
  PaymentsPublicController,
} from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [
    PaymentsAdminController,
    PaymentsPortalController,
    PaymentsPublicController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
