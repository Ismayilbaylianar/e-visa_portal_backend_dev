import { Module } from '@nestjs/common';
import { TemplateFieldsController } from './template-fields.controller';
import { TemplateFieldsService } from './template-fields.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [TemplateFieldsController],
  providers: [TemplateFieldsService],
  exports: [TemplateFieldsService],
})
export class TemplateFieldsModule {}
