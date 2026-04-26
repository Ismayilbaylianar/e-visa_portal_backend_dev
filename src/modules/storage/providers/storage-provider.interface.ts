/**
 * Storage Provider Interface
 *
 * Defines the contract for all storage providers (local, S3, etc.)
 * Business logic depends on this interface, not concrete implementations.
 */

export interface StorageUploadOptions {
  /** Content type / MIME type */
  contentType: string;
  /** Optional metadata to store with the file */
  metadata?: Record<string, string>;
  /** Whether file should be publicly accessible (for S3) */
  isPublic?: boolean;
}

export interface StorageUploadResult {
  /** Unique storage key (path in local, key in S3) */
  storageKey: string;
  /** Full URL or path to access the file */
  url: string;
  /** Provider name (local, s3, etc.) */
  provider: string;
  /** Optional: ETag or version ID from provider */
  etag?: string;
}

export interface StorageDownloadResult {
  /** File buffer */
  buffer: Buffer;
  /** Content type / MIME type */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

export interface StorageSignedUrlOptions {
  /** Expiration time in seconds */
  expiresIn: number;
  /** Content type for upload URLs */
  contentType?: string;
  /** Content disposition for download URLs */
  contentDisposition?: string;
}

export interface StorageDeleteResult {
  /** Whether deletion was successful */
  success: boolean;
  /** Storage key that was deleted */
  storageKey: string;
}

export interface StorageFileInfo {
  /** Storage key */
  storageKey: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
  /** Content type */
  contentType?: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

export interface StorageProvider {
  /** Provider name identifier */
  readonly providerName: string;

  /**
   * Upload a file to storage
   * @param key Storage key (path/filename)
   * @param data File buffer
   * @param options Upload options
   */
  upload(key: string, data: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult>;

  /**
   * Download a file from storage
   * @param key Storage key
   */
  download(key: string): Promise<StorageDownloadResult>;

  /**
   * Delete a file from storage
   * @param key Storage key
   */
  delete(key: string): Promise<StorageDeleteResult>;

  /**
   * Check if a file exists
   * @param key Storage key
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file info without downloading
   * @param key Storage key
   */
  getFileInfo(key: string): Promise<StorageFileInfo | null>;

  /**
   * Generate a signed URL for direct access (mainly for S3)
   * Local provider returns direct path
   * @param key Storage key
   * @param options URL options
   */
  getSignedUrl(key: string, options?: StorageSignedUrlOptions): Promise<string>;

  /**
   * Get the base URL/path for this provider
   */
  getBaseUrl(): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
