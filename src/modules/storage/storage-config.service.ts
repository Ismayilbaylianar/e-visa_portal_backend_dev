import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StorageConfig {
  provider: 'local' | 's3';
  local: {
    path: string;
    baseUrl: string;
  };
  s3: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl?: string;
    forcePathStyle: boolean;
  };
  validation: {
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  };
}

export interface StorageConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class StorageConfigService implements OnModuleInit {
  private readonly logger = new Logger(StorageConfigService.name);
  private config: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  onModuleInit(): void {
    const validation = this.validate();

    if (validation.warnings.length > 0) {
      validation.warnings.forEach((w) => this.logger.warn(w));
    }

    if (!validation.isValid) {
      validation.errors.forEach((e) => this.logger.error(e));
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      if (isProduction && this.config.provider === 's3') {
        throw new Error(`Invalid storage configuration: ${validation.errors.join(', ')}`);
      }
    }

    this.logger.log(`Storage configuration loaded:`);
    this.logger.log(`  Provider: ${this.config.provider}`);
    if (this.config.provider === 'local') {
      this.logger.log(`  Path: ${this.config.local.path}`);
    } else {
      this.logger.log(`  S3 Bucket: ${this.config.s3.bucket}`);
      this.logger.log(`  S3 Region: ${this.config.s3.region}`);
    }
    this.logger.log(`  Max file size: ${this.config.validation.maxFileSizeBytes / 1024 / 1024}MB`);
    this.logger.log(`  Allowed types: ${this.config.validation.allowedMimeTypes.length} types`);
  }

  private loadConfig(): StorageConfig {
    const provider = this.configService.get<string>('STORAGE_PROVIDER') || 'local';

    return {
      provider: provider as 'local' | 's3',
      local: {
        path:
          this.configService.get<string>('STORAGE_LOCAL_PATH') ||
          this.configService.get<string>('UPLOAD_PATH') ||
          './uploads',
        baseUrl:
          this.configService.get<string>('STORAGE_LOCAL_BASE_URL') ||
          this.configService.get<string>('APP_URL') ||
          'http://localhost:3000',
      },
      s3: {
        bucket: this.configService.get<string>('STORAGE_S3_BUCKET') || '',
        region: this.configService.get<string>('STORAGE_S3_REGION') || 'us-east-1',
        endpoint: this.configService.get<string>('STORAGE_S3_ENDPOINT'),
        accessKeyId: this.configService.get<string>('STORAGE_S3_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('STORAGE_S3_SECRET_ACCESS_KEY') || '',
        publicUrl: this.configService.get<string>('STORAGE_S3_PUBLIC_URL'),
        forcePathStyle: this.configService.get<string>('STORAGE_S3_FORCE_PATH_STYLE') === 'true',
      },
      validation: {
        maxFileSizeBytes: parseInt(
          this.configService.get<string>('STORAGE_MAX_FILE_SIZE') ||
            this.configService.get<string>('MAX_FILE_SIZE') ||
            '10485760',
          10,
        ),
        allowedMimeTypes: this.parseAllowedMimeTypes(),
        allowedExtensions: this.parseAllowedExtensions(),
      },
    };
  }

  private parseAllowedMimeTypes(): string[] {
    const defaultTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    const envTypes = this.configService.get<string>('STORAGE_ALLOWED_MIME_TYPES');
    if (envTypes) {
      return envTypes.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return defaultTypes;
  }

  private parseAllowedExtensions(): string[] {
    const defaultExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

    const envExtensions = this.configService.get<string>('STORAGE_ALLOWED_EXTENSIONS');
    if (envExtensions) {
      return envExtensions.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    }
    return defaultExtensions;
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  getProvider(): 'local' | 's3' {
    return this.config.provider;
  }

  getValidationConfig(): StorageConfig['validation'] {
    return this.config.validation;
  }

  isLocalProvider(): boolean {
    return this.config.provider === 'local';
  }

  isS3Provider(): boolean {
    return this.config.provider === 's3';
  }

  validate(): StorageConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.config.provider === 's3') {
      if (!this.config.s3.bucket) {
        errors.push('STORAGE_S3_BUCKET is required for S3 provider');
      }
      if (!this.config.s3.accessKeyId) {
        errors.push('STORAGE_S3_ACCESS_KEY_ID is required for S3 provider');
      }
      if (!this.config.s3.secretAccessKey) {
        errors.push('STORAGE_S3_SECRET_ACCESS_KEY is required for S3 provider');
      }
    }

    if (this.config.provider === 'local') {
      if (!this.config.local.path) {
        warnings.push('STORAGE_LOCAL_PATH not set, using default: ./uploads');
      }
    }

    if (this.config.validation.maxFileSizeBytes > 100 * 1024 * 1024) {
      warnings.push('Max file size is set to over 100MB, this may cause memory issues');
    }

    if (this.config.validation.allowedMimeTypes.length === 0) {
      errors.push('No allowed MIME types configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
