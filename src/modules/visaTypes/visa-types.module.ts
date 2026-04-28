import { Module } from '@nestjs/common';
import { VisaTypesController } from './visa-types.controller';
import { VisaTypesService } from './visa-types.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [VisaTypesController],
  providers: [VisaTypesService],
  exports: [VisaTypesService],
})
export class VisaTypesModule {}
