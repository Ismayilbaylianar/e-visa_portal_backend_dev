import { Module } from '@nestjs/common';
import {
  ContentPagesAdminController,
  ContentPagesPublicController,
} from './content-pages.controller';
import { ContentPagesService } from './content-pages.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ContentPagesAdminController, ContentPagesPublicController],
  providers: [ContentPagesService],
  exports: [ContentPagesService],
})
export class ContentPagesModule {}
