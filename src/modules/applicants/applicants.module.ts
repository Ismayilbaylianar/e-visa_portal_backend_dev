import { Module } from '@nestjs/common';
import { ApplicantsPortalController, ApplicantsAdminController } from './applicants.controller';
import { ApplicantsService } from './applicants.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
// EmailModule is @Global, so we don't need to import it explicitly.
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PortalAuthModule,
    StorageModule,
    AuditLogsModule,
    // M11.5 — visa-issued notification fires from issueVisa().
    NotificationsModule,
  ],
  controllers: [ApplicantsPortalController, ApplicantsAdminController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
