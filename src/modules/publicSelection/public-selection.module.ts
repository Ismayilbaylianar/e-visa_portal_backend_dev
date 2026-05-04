import { Module } from '@nestjs/common';
import { PublicSelectionController } from './public-selection.controller';
import { PublicSelectionService } from './public-selection.service';
import { GeoLookupModule } from '../geoLookup/geo-lookup.module';

@Module({
  imports: [GeoLookupModule],
  controllers: [PublicSelectionController],
  providers: [PublicSelectionService],
  exports: [PublicSelectionService],
})
export class PublicSelectionModule {}
