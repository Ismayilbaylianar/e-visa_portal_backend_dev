import { Module } from '@nestjs/common';
import { VisaTypesAdminController, VisaTypesPublicController } from './visa-types.controller';
import { VisaTypesService } from './visa-types.service';

@Module({
  controllers: [VisaTypesAdminController, VisaTypesPublicController],
  providers: [VisaTypesService],
  exports: [VisaTypesService],
})
export class VisaTypesModule {}
