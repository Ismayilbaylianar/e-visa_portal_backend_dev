import { Module } from '@nestjs/common';
import { TemplateBindingsController } from './template-bindings.controller';
import { TemplateBindingsService } from './template-bindings.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
import { CountryPageAutocreateService } from '../countryPages/country-page-autocreate.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [TemplateBindingsController],
  providers: [CountryPageAutocreateService, TemplateBindingsService],
  exports: [TemplateBindingsService],
})
export class TemplateBindingsModule {}
