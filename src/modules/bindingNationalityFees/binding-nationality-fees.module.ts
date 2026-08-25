import { Module } from '@nestjs/common';
import { BindingNationalityFeesController } from './binding-nationality-fees.controller';
import { BindingNationalityFeesService } from './binding-nationality-fees.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
import { CountryPageAutocreateService } from '../countryPages/country-page-autocreate.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [BindingNationalityFeesController],
  providers: [CountryPageAutocreateService, BindingNationalityFeesService],
  exports: [BindingNationalityFeesService],
})
export class BindingNationalityFeesModule {}
