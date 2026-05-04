import { Module } from '@nestjs/common';
import { FaqItemsAdminController, FaqItemsPublicController } from './faq-items.controller';
import { FaqItemsService } from './faq-items.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [FaqItemsAdminController, FaqItemsPublicController],
  providers: [FaqItemsService],
  exports: [FaqItemsService],
})
export class FaqItemsModule {}
