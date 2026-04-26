import { Module } from '@nestjs/common';
import {
  ApplicationsAdminController,
  ApplicationsPortalController,
} from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [PortalAuthModule, AuditLogsModule],
  controllers: [ApplicationsAdminController, ApplicationsPortalController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
