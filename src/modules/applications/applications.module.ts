import { Module, forwardRef } from '@nestjs/common';
import {
  ApplicationsAdminController,
  ApplicationsPortalController,
} from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { ApplicantsModule } from '../applicants/applicants.module';

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
  ],
  controllers: [ApplicationsAdminController, ApplicationsPortalController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
