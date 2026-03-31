import { Module } from '@nestjs/common';
import { StatusWorkflowService } from './status-workflow.service';

@Module({
  providers: [StatusWorkflowService],
  exports: [StatusWorkflowService],
})
export class StatusWorkflowModule {}
