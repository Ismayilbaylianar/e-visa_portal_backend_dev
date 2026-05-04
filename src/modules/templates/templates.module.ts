import { Module, forwardRef } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
// M11.2 — bulk-upsert endpoint lives on the templates URL space but
// delegates to TemplateBindingsService. forwardRef avoids circular
// init if the bindings module ever imports back into templates.
import { TemplateBindingsModule } from '../templateBindings/template-bindings.module';

@Module({
  imports: [AuditLogsModule, forwardRef(() => TemplateBindingsModule)],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
