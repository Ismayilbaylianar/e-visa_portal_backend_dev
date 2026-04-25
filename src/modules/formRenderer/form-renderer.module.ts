import { Module } from '@nestjs/common';
import { FormRendererController } from './form-renderer.controller';
import { FormRendererService } from './form-renderer.service';
import { PortalAuthModule } from '../portalAuth/portal-auth.module';

@Module({
  imports: [PortalAuthModule],
  controllers: [FormRendererController],
  providers: [FormRendererService],
  exports: [FormRendererService],
})
export class FormRendererModule {}
