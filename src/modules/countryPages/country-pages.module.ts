import { Module } from '@nestjs/common';
import { CountryPagesController } from './country-pages.controller';
import { CountryPagesService } from './country-pages.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [CountryPagesController],
  providers: [CountryPagesService],
  exports: [CountryPagesService],
})
export class CountryPagesModule {}
