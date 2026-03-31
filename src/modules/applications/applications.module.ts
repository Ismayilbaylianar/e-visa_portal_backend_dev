import { Module } from '@nestjs/common';
import {
  ApplicationsAdminController,
  ApplicationsPortalController,
} from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsAdminController, ApplicationsPortalController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
