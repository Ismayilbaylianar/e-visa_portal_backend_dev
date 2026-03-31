import { Module } from '@nestjs/common';
import { PortalSessionsService } from './portal-sessions.service';

@Module({
  providers: [PortalSessionsService],
  exports: [PortalSessionsService],
})
export class PortalSessionsModule {}
