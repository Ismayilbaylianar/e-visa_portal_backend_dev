import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
