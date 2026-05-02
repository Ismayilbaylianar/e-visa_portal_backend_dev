import { Module } from '@nestjs/common';
import { TemplateSectionsController } from './template-sections.controller';
import { TemplateSectionsService } from './template-sections.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [TemplateSectionsController],
  providers: [TemplateSectionsService],
  exports: [TemplateSectionsService],
})
export class TemplateSectionsModule {}
