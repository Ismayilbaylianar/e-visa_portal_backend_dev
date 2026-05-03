import { Module } from '@nestjs/common';
import { TemplateBindingsController } from './template-bindings.controller';
import { TemplateBindingsService } from './template-bindings.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [TemplateBindingsController],
  providers: [TemplateBindingsService],
  exports: [TemplateBindingsService],
})
export class TemplateBindingsModule {}
