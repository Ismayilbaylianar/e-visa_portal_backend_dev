import { Module } from '@nestjs/common';
import { PublicSelectionController } from './public-selection.controller';
import { PublicSelectionService } from './public-selection.service';

@Module({
  controllers: [PublicSelectionController],
  providers: [PublicSelectionService],
  exports: [PublicSelectionService],
})
export class PublicSelectionModule {}
