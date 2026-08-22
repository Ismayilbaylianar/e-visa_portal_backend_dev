import { Module, forwardRef } from '@nestjs/common';
import {
  ApplicationsAdminController,
  ApplicationsPortalController,
} from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PaymentTimeoutService } from './payment-timeout.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { ApplicantsModule } from '../applicants/applicants.module';
import { CustomerPortalModule } from '../customerPortal/customer-portal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { ApplicationCompletenessService } from './application-completeness.service';

@Module({
  imports: [
    PortalAuthModule,
    AuditLogsModule,
    EmailModule,
    // Module 9 — applications controller hosts the issue-visa endpoint
    // (`/admin/applications/:id/applicants/:applicantId/issue-visa`)
    // so we need ApplicantsService here. forwardRef avoids circular
    // module init when ApplicantsModule eventually imports back.
    forwardRef(() => ApplicantsModule),
    // Module 9b — resubmit endpoint lives in ApplicationsPortalController
    // (URL group fits there) but its logic is in CustomerPortalService.
    CustomerPortalModule,
    // M11.5 — emit Telegram events on submit/approve/reject.
    NotificationsModule,
    // M11.10 — read maintenance toggle in applications.create() guard.
    SettingsModule,
    // Stage 3 — accept captures / cancel releases the held payment.
    PaymentsModule,
  ],
  controllers: [ApplicationsAdminController, ApplicationsPortalController],
  // PaymentTimeoutService runs the 3-hour payment-window sweep via
  // OnModuleInit + setInterval (single PM2 fork instance → no double-fire).
  providers: [ApplicationCompletenessService, ApplicationsService, PaymentTimeoutService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
