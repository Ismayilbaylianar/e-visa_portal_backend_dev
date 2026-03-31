import { Module } from '@nestjs/common';
import { FormRendererController } from './form-renderer.controller';
import { FormRendererService } from './form-renderer.service';

@Module({
  controllers: [FormRendererController],
  providers: [FormRendererService],
  exports: [FormRendererService],
})
export class FormRendererModule {}
