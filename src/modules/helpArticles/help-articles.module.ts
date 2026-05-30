import { Module } from '@nestjs/common';
import { HelpArticlesAdminController } from './help-articles.controller';
import { HelpArticlesService } from './help-articles.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

/**
 * M11.15 (HELP) — operator help / training module.
 */
@Module({
  imports: [PrismaModule, StorageModule, AuditLogsModule],
  controllers: [HelpArticlesAdminController],
  providers: [HelpArticlesService],
})
export class HelpArticlesModule {}
