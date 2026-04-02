import { Module } from '@nestjs/common';
import { VisaTypesController } from './visa-types.controller';
import { VisaTypesService } from './visa-types.service';

@Module({
  controllers: [VisaTypesController],
  providers: [VisaTypesService],
  exports: [VisaTypesService],
})
export class VisaTypesModule {}
