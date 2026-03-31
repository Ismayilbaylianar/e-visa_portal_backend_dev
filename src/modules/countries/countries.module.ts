import { Module } from '@nestjs/common';
import { AdminCountriesController, PublicCountriesController } from './countries.controller';
import { CountriesService } from './countries.service';

@Module({
  controllers: [AdminCountriesController, PublicCountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}
