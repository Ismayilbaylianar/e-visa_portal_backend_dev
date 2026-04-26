import { Module } from '@nestjs/common';
import { DocumentsPortalController, DocumentsAdminController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [PortalAuthModule, AuditLogsModule],
  controllers: [DocumentsPortalController, DocumentsAdminController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
