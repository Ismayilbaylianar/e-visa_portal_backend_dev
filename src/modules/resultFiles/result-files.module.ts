import { Module } from '@nestjs/common';
import { ResultFilesController } from './result-files.controller';
import { ResultFilesService } from './result-files.service';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [StorageModule, AuditLogsModule],
  controllers: [ResultFilesController],
  providers: [ResultFilesService],
  exports: [ResultFilesService],
})
export class ResultFilesModule {}
