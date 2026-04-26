import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageFileInfo,
  StorageSignedUrlOptions,
  STORAGE_PROVIDER,
} from './providers';

export interface StorageServiceUploadOptions extends StorageUploadOptions {
  /** Prefix/directory for the file */
  prefix?: string;
  /** Use original filename (sanitized) or generate unique name */
  preserveFilename?: boolean;
  /** Original filename (used for extension and optional preservation) */
  originalFilename?: string;
}

export interface StorageServiceUploadResult extends StorageUploadResult {
  /** Generated safe filename */
  filename: string;
  /** Original filename */
  originalFilename?: string;
  /** File checksum (MD5) */
  checksum: string;
  /** File size */
  size: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {
    this.logger.log(
      `StorageService initialized with provider: ${this.storageProvider.providerName}`,
    );
  }

  /**
   * Get the current storage provider name
   */
  getProviderName(): string {
    return this.storageProvider.providerName;
  }

  /**
   * Upload a file with automatic filename generation and checksum
   */
  async upload(
    data: Buffer,
    options: StorageServiceUploadOptions,
  ): Promise<StorageServiceUploadResult> {
    const checksum = this.calculateChecksum(data);
    const filename = this.generateFilename(options);
    const storageKey = this.buildStorageKey(filename, options.prefix);

    this.logger.debug(
      `Uploading file: ${storageKey} (${data.length} bytes, checksum: ${checksum})`,
    );

    const result = await this.storageProvider.upload(storageKey, data, {
      contentType: options.contentType,
      metadata: {
        ...options.metadata,
        checksum,
        originalFilename: options.originalFilename || '',
      },
      isPublic: options.isPublic,
    });

    return {
      ...result,
      filename,
      originalFilename: options.originalFilename,
      checksum,
      size: data.length,
    };
  }

  /**
   * Download a file
   */
  async download(storageKey: string): Promise<StorageDownloadResult> {
    this.logger.debug(`Downloading file: ${storageKey}`);
    return this.storageProvider.download(storageKey);
  }

  /**
   * Delete a file
   */
  async delete(storageKey: string): Promise<StorageDeleteResult> {
    this.logger.debug(`Deleting file: ${storageKey}`);
    return this.storageProvider.delete(storageKey);
  }

  /**
   * Check if a file exists
   */
  async exists(storageKey: string): Promise<boolean> {
    return this.storageProvider.exists(storageKey);
  }

  /**
   * Get file info without downloading
   */
  async getFileInfo(storageKey: string): Promise<StorageFileInfo | null> {
    return this.storageProvider.getFileInfo(storageKey);
  }

  /**
   * Get a signed URL for direct file access
   */
  async getSignedUrl(storageKey: string, options?: StorageSignedUrlOptions): Promise<string> {
    return this.storageProvider.getSignedUrl(storageKey, options);
  }

  /**
   * Get the base URL for this storage provider
   */
  getBaseUrl(): string {
    return this.storageProvider.getBaseUrl();
  }

  /**
   * Verify file integrity by comparing checksums
   */
  async verifyChecksum(storageKey: string, expectedChecksum: string): Promise<boolean> {
    try {
      const { buffer } = await this.download(storageKey);
      const actualChecksum = this.calculateChecksum(buffer);
      return actualChecksum === expectedChecksum;
    } catch {
      return false;
    }
  }

  /**
   * Calculate MD5 checksum of data
   */
  calculateChecksum(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Generate a safe, unique filename
   */
  private generateFilename(options: StorageServiceUploadOptions): string {
    const extension = options.originalFilename
      ? path.extname(options.originalFilename).toLowerCase()
      : '';

    if (options.preserveFilename && options.originalFilename) {
      return this.sanitizeFilename(options.originalFilename);
    }

    const uniqueId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}_${uniqueId}${extension}`;
  }

  /**
   * Sanitize a filename to be safe for storage
   */
  private sanitizeFilename(filename: string): string {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);

    const safeName = name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);

    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    return `${safeName}_${uniqueSuffix}${ext.toLowerCase()}`;
  }

  /**
   * Build a storage key from filename and optional prefix
   */
  private buildStorageKey(filename: string, prefix?: string): string {
    if (prefix) {
      const safePrefix = prefix.replace(/^\/+|\/+$/g, '');
      return `${safePrefix}/${filename}`;
    }
    return filename;
  }
}
