import { Module } from '@nestjs/common';
import {
  HomepageSlidesAdminController,
  HomepageSlidesPublicController,
} from './homepage-slides.controller';
import { HomepageSlidesService } from './homepage-slides.service';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [StorageModule, AuditLogsModule],
  controllers: [
    HomepageSlidesAdminController,
    HomepageSlidesPublicController,
  ],
  providers: [HomepageSlidesService],
  exports: [HomepageSlidesService],
})
export class HomepageSlidesModule {}
