import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageFileInfo,
  StorageSignedUrlOptions,
} from './storage-provider.interface';

/**
 * Local Filesystem Storage Provider
 *
 * Stores files on the local filesystem.
 * Suitable for development and single-server deployments.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  readonly providerName = 'local';
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath =
      this.configService.get<string>('STORAGE_LOCAL_PATH') ||
      this.configService.get<string>('UPLOAD_PATH') ||
      './uploads';

    this.baseUrl =
      this.configService.get<string>('STORAGE_LOCAL_BASE_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000';

    this.ensureBaseDirectory();
    this.logger.log(`LocalStorageProvider initialized with base path: ${this.basePath}`);
  }

  private ensureBaseDirectory(): void {
    const absolutePath = this.getAbsolutePath('');
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      this.logger.log(`Created storage directory: ${absolutePath}`);
    }
  }

  private getAbsolutePath(key: string): string {
    const normalizedKey = this.sanitizePath(key);
    return path.resolve(this.basePath, normalizedKey);
  }

  private sanitizePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalized.startsWith('/') || normalized.startsWith('\\')) {
      return normalized.slice(1);
    }
    return normalized;
  }

  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async upload(
    key: string,
    data: Buffer,
    options: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    const absolutePath = this.getAbsolutePath(key);

    this.ensureDirectoryExists(absolutePath);

    try {
      fs.writeFileSync(absolutePath, data);

      const hash = crypto.createHash('md5').update(data).digest('hex');

      if (options.metadata) {
        const metadataPath = `${absolutePath}.meta.json`;
        fs.writeFileSync(
          metadataPath,
          JSON.stringify({
            contentType: options.contentType,
            metadata: options.metadata,
            uploadedAt: new Date().toISOString(),
          }),
        );
      }

      this.logger.debug(`File uploaded: ${key} (${data.length} bytes)`);

      return {
        storageKey: key,
        url: this.buildUrl(key),
        provider: this.providerName,
        etag: hash,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${key}`, error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async download(key: string): Promise<StorageDownloadResult> {
    const absolutePath = this.getAbsolutePath(key);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${key}`);
    }

    try {
      const buffer = fs.readFileSync(absolutePath);
      const stats = fs.statSync(absolutePath);

      let contentType = 'application/octet-stream';
      let metadata: Record<string, string> | undefined;

      const metadataPath = `${absolutePath}.meta.json`;
      if (fs.existsSync(metadataPath)) {
        try {
          const metaContent = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          contentType = metaContent.contentType || contentType;
          metadata = metaContent.metadata;
        } catch {
          // Ignore metadata read errors
        }
      } else {
        contentType = this.guessContentType(key);
      }

      return {
        buffer,
        contentType,
        size: stats.size,
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to download file: ${key}`, error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async delete(key: string): Promise<StorageDeleteResult> {
    const absolutePath = this.getAbsolutePath(key);

    if (!fs.existsSync(absolutePath)) {
      this.logger.warn(`File not found for deletion: ${key}`);
      return { success: true, storageKey: key };
    }

    try {
      fs.unlinkSync(absolutePath);

      const metadataPath = `${absolutePath}.meta.json`;
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      this.logger.debug(`File deleted: ${key}`);
      return { success: true, storageKey: key };
    } catch (error) {
      this.logger.error(`Failed to delete file: ${key}`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const absolutePath = this.getAbsolutePath(key);
    return fs.existsSync(absolutePath);
  }

  async getFileInfo(key: string): Promise<StorageFileInfo | null> {
    const absolutePath = this.getAbsolutePath(key);

    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(absolutePath);
      let contentType: string | undefined;
      let metadata: Record<string, string> | undefined;

      const metadataPath = `${absolutePath}.meta.json`;
      if (fs.existsSync(metadataPath)) {
        try {
          const metaContent = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          contentType = metaContent.contentType;
          metadata = metaContent.metadata;
        } catch {
          // Ignore metadata read errors
        }
      }

      return {
        storageKey: key,
        size: stats.size,
        lastModified: stats.mtime,
        contentType: contentType || this.guessContentType(key),
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get file info: ${key}`, error);
      return null;
    }
  }

  async getSignedUrl(key: string, _options?: StorageSignedUrlOptions): Promise<string> {
    return this.buildUrl(key);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private buildUrl(key: string): string {
    const safePath = this.sanitizePath(key);
    return `${this.baseUrl}/api/v1/files/${safePath}`;
  }

  private guessContentType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
