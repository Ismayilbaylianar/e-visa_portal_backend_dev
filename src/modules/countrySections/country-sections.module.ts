import { Module } from '@nestjs/common';
import { CountrySectionsController } from './country-sections.controller';
import { CountrySectionsService } from './country-sections.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [CountrySectionsController],
  providers: [CountrySectionsService],
  exports: [CountrySectionsService],
})
export class CountrySectionsModule {}
