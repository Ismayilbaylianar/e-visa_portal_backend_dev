import { Module } from '@nestjs/common';
import { BindingNationalityFeesController } from './binding-nationality-fees.controller';
import { BindingNationalityFeesService } from './binding-nationality-fees.service';

@Module({
  controllers: [BindingNationalityFeesController],
  providers: [BindingNationalityFeesService],
  exports: [BindingNationalityFeesService],
})
export class BindingNationalityFeesModule {}
