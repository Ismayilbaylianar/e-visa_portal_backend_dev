import { Module } from '@nestjs/common';
import {
  CountryPageImagesAdminController,
  CountryPageImagesPublicController,
} from './country-page-images.controller';
import { CountryPageImagesService } from './country-page-images.service';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [StorageModule, AuditLogsModule],
  controllers: [
    CountryPageImagesAdminController,
    CountryPageImagesPublicController,
  ],
  providers: [CountryPageImagesService],
  exports: [CountryPageImagesService],
})
export class CountryPageImagesModule {}
