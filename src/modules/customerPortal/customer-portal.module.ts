import { Module } from '@nestjs/common';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [
    PortalAuthModule,
    // M9b — resubmit endpoint needs storage uploads + audit writes.
    // EmailService is provided by the @Global() EmailModule so no
    // import line is needed for it here.
    StorageModule,
    AuditLogsModule,
  ],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
  exports: [CustomerPortalService],
})
export class CustomerPortalModule {}
