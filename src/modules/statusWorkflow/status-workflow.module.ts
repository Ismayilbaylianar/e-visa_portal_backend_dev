import { Module } from '@nestjs/common';
import { StatusWorkflowService } from './status-workflow.service';
import { StatusWorkflowController } from './status-workflow.controller';

@Module({
  controllers: [StatusWorkflowController],
  providers: [StatusWorkflowService],
  exports: [StatusWorkflowService],
})
export class StatusWorkflowModule {}
