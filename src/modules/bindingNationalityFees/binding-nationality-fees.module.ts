import { Module } from '@nestjs/common';
import { BindingNationalityFeesController } from './binding-nationality-fees.controller';
import { BindingNationalityFeesService } from './binding-nationality-fees.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [BindingNationalityFeesController],
  providers: [BindingNationalityFeesService],
  exports: [BindingNationalityFeesService],
})
export class BindingNationalityFeesModule {}
