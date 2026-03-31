import { Module } from '@nestjs/common';
import { CountrySectionsController } from './country-sections.controller';
import { CountrySectionsService } from './country-sections.service';

@Module({
  controllers: [CountrySectionsController],
  providers: [CountrySectionsService],
  exports: [CountrySectionsService],
})
export class CountrySectionsModule {}
