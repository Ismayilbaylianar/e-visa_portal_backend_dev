import { Module } from '@nestjs/common';
import { ApplicantsPortalController, ApplicantsAdminController } from './applicants.controller';
import { ApplicantsService } from './applicants.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';

@Module({
  imports: [PortalAuthModule],
  controllers: [ApplicantsPortalController, ApplicantsAdminController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
