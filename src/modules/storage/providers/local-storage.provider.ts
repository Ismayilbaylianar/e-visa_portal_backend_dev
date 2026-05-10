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
        // M11.11 (BUG C) — upload result returns the unsigned base
        // URL; consumers needing access call getSignedUrl() to mint
        // a token. (Direct unsigned URL would 404 in the new
        // FilesController which requires a signed token.)
        url: `${this.baseUrl}/api/v1/files/${this.sanitizePath(key)}`,
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

  async getSignedUrl(key: string, options?: StorageSignedUrlOptions): Promise<string> {
    return this.buildSignedUrl(key, options);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * M11.11 (BUG C) — HMAC-signed URL for direct file access via the
   * FilesController. Token format: `<base64url-payload>.<base64url-sig>`
   * where payload = JSON{ k: storageKey, e: expiryEpochSeconds, d?: 'inline'|'attachment', f?: filename }
   * and sig = HMAC-SHA256(payload, FILES_SIGNING_SECRET || JWT_SECRET).
   *
   * Doesn't depend on JwtService (avoid circular module imports from
   * the storage layer); plain crypto + HMAC is sufficient since the
   * URL is short-lived and the secret is only on the server.
   */
  private buildSignedUrl(key: string, options?: StorageSignedUrlOptions): string {
    const safePath = this.sanitizePath(key);
    const expiresIn = options?.expiresIn ?? 3600;
    const expiryEpochSec = Math.floor(Date.now() / 1000) + expiresIn;
    const disposition = options?.contentDisposition ?? '';
    const isInline = /^\s*inline/i.test(disposition);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : undefined;

    const payload = {
      k: safePath,
      e: expiryEpochSec,
      d: isInline ? 'inline' : 'attachment',
      ...(filename ? { f: filename } : {}),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret =
      this.configService.get<string>('FILES_SIGNING_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      '';
    if (!secret) {
      this.logger.error('No FILES_SIGNING_SECRET / JWT_SECRET configured — file URLs will fail validation.');
    }
    const sig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    const token = `${payloadB64}.${sig}`;

    return `${this.baseUrl}/api/v1/files/${safePath}?token=${token}`;
  }

  /**
   * M11.11 (BUG C) — Validate a signed token issued by buildSignedUrl.
   * Returns the decoded payload on success, throws on any failure
   * (signature mismatch, expired, malformed, key drift).
   */
  verifySignedToken(token: string, expectedKey: string): {
    disposition: 'inline' | 'attachment';
    filename?: string;
  } {
    const [payloadB64, sig] = (token || '').split('.');
    if (!payloadB64 || !sig) throw new Error('Malformed token');
    const secret =
      this.configService.get<string>('FILES_SIGNING_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      '';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      throw new Error('Invalid signature');
    }
    let payload: { k: string; e: number; d?: string; f?: string };
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch {
      throw new Error('Malformed payload');
    }
    if (typeof payload.e !== 'number' || payload.e < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    if (payload.k !== expectedKey) {
      throw new Error('Token key mismatch');
    }
    return {
      disposition: payload.d === 'inline' ? 'inline' : 'attachment',
      filename: payload.f,
    };
  }

  /**
   * M11.11 (BUG C) — Stream-friendly read for the FilesController so
   * it doesn't have to load the whole file into memory before
   * responding. Used in addition to the existing buffer-based
   * `download()`.
   */
  createReadStream(key: string): NodeJS.ReadableStream {
    const absolutePath = this.getAbsolutePath(key);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(absolutePath);
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
