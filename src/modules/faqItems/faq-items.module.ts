import { Module } from '@nestjs/common';
import {
  FaqCategoriesAdminController,
  FaqItemsAdminController,
  FaqItemsPublicController,
} from './faq-items.controller';
import { FaqItemsService } from './faq-items.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [
    FaqItemsAdminController,
    FaqItemsPublicController,
    FaqCategoriesAdminController,
  ],
  providers: [FaqItemsService],
  exports: [FaqItemsService],
})
export class FaqItemsModule {}
