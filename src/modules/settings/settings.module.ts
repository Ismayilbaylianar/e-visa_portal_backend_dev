import { Module } from '@nestjs/common';
import { SettingsController, PublicSystemController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [SettingsController, PublicSystemController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
