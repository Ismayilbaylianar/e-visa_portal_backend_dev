import { Module } from '@nestjs/common';
import { TemplateSectionsController } from './template-sections.controller';
import { TemplateSectionsService } from './template-sections.service';

@Module({
  controllers: [TemplateSectionsController],
  providers: [TemplateSectionsService],
  exports: [TemplateSectionsService],
})
export class TemplateSectionsModule {}
