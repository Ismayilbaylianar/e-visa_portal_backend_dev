import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { StorageModule } from '../storage/storage.module';

/**
 * M11.11 (BUG C) — Mounts /api/v1/files/* serving so signed URLs
 * issued by the storage layer actually resolve. Pulls in
 * StorageModule for the StorageService + LocalStorageProvider.
 */
@Module({
  imports: [StorageModule],
  controllers: [FilesController],
})
export class FilesModule {}
