import { Module } from '@nestjs/common';
import {
  ContactInfoAdminController,
  ContactInfoPublicController,
} from './contact-info.controller';
import { ContactInfoService } from './contact-info.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ContactInfoAdminController, ContactInfoPublicController],
  providers: [ContactInfoService],
  exports: [ContactInfoService],
})
export class ContactInfoModule {}
