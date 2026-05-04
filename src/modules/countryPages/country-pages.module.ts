import { Module } from '@nestjs/common';
import { CountryPagesController } from './country-pages.controller';
import { CountryPagesService } from './country-pages.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';
// M11.1 — public detail endpoint resolves image storage keys → URLs.
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuditLogsModule, StorageModule],
  controllers: [CountryPagesController],
  providers: [CountryPagesService],
  exports: [CountryPagesService],
})
export class CountryPagesModule {}
