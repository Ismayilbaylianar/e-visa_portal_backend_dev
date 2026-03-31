import { Module } from '@nestjs/common';
import {
  ApplicantsPortalController,
  ApplicantsAdminController,
} from './applicants.controller';
import { ApplicantsService } from './applicants.service';

@Module({
  controllers: [ApplicantsPortalController, ApplicantsAdminController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
