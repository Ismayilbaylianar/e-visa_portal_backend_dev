import { Module } from '@nestjs/common';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalPublicController } from './customer-portal-public.controller';
import { CustomerPortalService } from './customer-portal.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
import { PortalTokenService } from '../applications/portal-token.service';

@Module({
  imports: [
    PortalAuthModule,
    // M9b — resubmit endpoint needs storage uploads + audit writes.
    // EmailService is provided by the @Global() EmailModule so no
    // import line is needed for it here.
    StorageModule,
    AuditLogsModule,
  ],
  controllers: [CustomerPortalController, CustomerPortalPublicController],
  // M11.13 (BUG U + T) — PortalTokenService is also used by
  // ApplicationsModule's email-sending path, but it's a stateless
  // helper with only ConfigService deps so re-providing it here is
  // safe + avoids a forwardRef chain. Exported so other modules
  // can reuse the same instance via re-import.
  providers: [CustomerPortalService, PortalTokenService],
  exports: [CustomerPortalService, PortalTokenService],
})
export class CustomerPortalModule {}
