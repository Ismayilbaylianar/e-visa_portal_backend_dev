import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  PaymentsAdminController,
  PaymentsPortalController,
  PaymentsPublicController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [ConfigModule, AuditLogsModule],
  controllers: [PaymentsAdminController, PaymentsPortalController, PaymentsPublicController],
  providers: [PaymentsService, MockPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
