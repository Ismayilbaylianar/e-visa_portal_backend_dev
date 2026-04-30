import { Module } from '@nestjs/common';
import { PaymentPageConfigsController } from './payment-page-configs.controller';
import { PaymentPageConfigsService } from './payment-page-configs.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [PaymentPageConfigsController],
  providers: [PaymentPageConfigsService],
  exports: [PaymentPageConfigsService],
})
export class PaymentPageConfigsModule {}
