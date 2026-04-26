import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORAGE_PROVIDER,
  LocalStorageProvider,
  S3StorageProvider,
} from './providers';
import { StorageService } from './storage.service';
import { StorageConfigService } from './storage-config.service';

/**
 * Storage Module
 *
 * Provides file storage abstraction with support for:
 * - Local filesystem storage
 * - S3-compatible object storage (AWS S3, MinIO, DigitalOcean Spaces)
 *
 * Environment variables:
 * - STORAGE_PROVIDER: 'local' or 's3' (default: 'local')
 *
 * For local storage:
 * - STORAGE_LOCAL_PATH or UPLOAD_PATH: Base directory for files
 * - STORAGE_LOCAL_BASE_URL or APP_URL: Base URL for file access
 *
 * For S3 storage:
 * - STORAGE_S3_BUCKET: S3 bucket name
 * - STORAGE_S3_REGION: AWS region (default: us-east-1)
 * - STORAGE_S3_ENDPOINT: Custom endpoint for S3-compatible services
 * - STORAGE_S3_ACCESS_KEY_ID: Access key
 * - STORAGE_S3_SECRET_ACCESS_KEY: Secret key
 * - STORAGE_S3_PUBLIC_URL: Public URL for the bucket (optional)
 * - STORAGE_S3_FORCE_PATH_STYLE: Use path-style URLs (for MinIO)
 */
@Global()
@Module({
  providers: [
    StorageConfigService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('STORAGE_PROVIDER') || 'local';

        if (provider === 's3') {
          return new S3StorageProvider(configService);
        }

        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService, StorageConfigService, STORAGE_PROVIDER],
})
export class StorageModule {}
