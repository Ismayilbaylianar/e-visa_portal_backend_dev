import { Module } from '@nestjs/common';
import { TemplateBindingsController } from './template-bindings.controller';
import { TemplateBindingsService } from './template-bindings.service';

@Module({
  controllers: [TemplateBindingsController],
  providers: [TemplateBindingsService],
  exports: [TemplateBindingsService],
})
export class TemplateBindingsModule {}
