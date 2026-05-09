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
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    AuditLogsModule,
    PortalAuthModule,
    // M11.5 — payment.received / payment.failed Telegram events.
    NotificationsModule,
  ],
  controllers: [PaymentsAdminController, PaymentsPortalController, PaymentsPublicController],
  providers: [PaymentsService, MockPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
