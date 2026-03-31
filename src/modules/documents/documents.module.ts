import { Module } from '@nestjs/common';
import {
  DocumentsPortalController,
  DocumentsAdminController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsPortalController, DocumentsAdminController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
