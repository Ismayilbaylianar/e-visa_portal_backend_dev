import { Module, forwardRef } from '@nestjs/common';
import { ApplicantsPortalController, ApplicantsAdminController } from './applicants.controller';
import { ApplicantsService } from './applicants.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
// EmailModule is @Global, so we don't need to import it explicitly.
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [
    PortalAuthModule,
    StorageModule,
    AuditLogsModule,
    // M11.5 — visa-issued notification fires from issueVisa().
    NotificationsModule,
    // Stage 3 Step 4 — the automatic READY_TO_DOWNLOAD transition reuses
    // ApplicationsService.notifyStatusChange so the customer gets the
    // same correct, signed download link as the manual admin path.
    // forwardRef because ApplicationsModule already imports this module.
    forwardRef(() => ApplicationsModule),
  ],
  controllers: [ApplicantsPortalController, ApplicantsAdminController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
