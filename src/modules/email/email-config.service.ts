import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Email Configuration
 */
export interface EmailConfig {
  provider: 'smtp' | 'console' | 'auto';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  };
  otp: {
    resendCooldownSeconds: number;
    maxAttemptsPerHour: number;
    expiryMinutes: number;
  };
  isProduction: boolean;
  isDevelopment: boolean;
}

/**
 * Email Configuration Validation Result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Email Config Service
 *
 * Handles email configuration loading, validation, and provides
 * a centralized access point for email-related settings.
 *
 * Features:
 * - Validates SMTP configuration in production mode
 * - Provides OTP throttling configuration
 * - Logs configuration issues on startup
 */
@Injectable()
export class EmailConfigService implements OnModuleInit {
  private readonly logger = new Logger(EmailConfigService.name);
  private config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  onModuleInit(): void {
    const validation = this.validate();

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => this.logger.warn(`Config Warning: ${w}`));
    }

    if (!validation.isValid) {
      validation.errors.forEach(e => this.logger.error(`Config Error: ${e}`));

      // In production, fail fast on invalid email configuration
      if (this.config.isProduction && this.config.provider === 'smtp') {
        throw new Error(
          `Invalid email configuration in production: ${validation.errors.join(', ')}`,
        );
      }
    }

    this.logger.log(
      `Email config loaded: provider=${this.config.provider}, ` +
        `smtpConfigured=${!!this.config.smtp.host}, ` +
        `isProduction=${this.config.isProduction}`,
    );
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): EmailConfig {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';

    return {
      provider: this.configService.get<'smtp' | 'console' | 'auto'>('EMAIL_PROVIDER', 'auto'),
      smtp: {
        host: this.configService.get<string>('SMTP_HOST', ''),
        port: parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10),
        secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
        fromEmail: this.configService.get<string>('SMTP_FROM_EMAIL', ''),
        fromName: this.configService.get<string>('SMTP_FROM_NAME', 'E-Visa Portal'),
      },
      otp: {
        resendCooldownSeconds: parseInt(
          this.configService.get<string>('OTP_RESEND_COOLDOWN_SECONDS', '60'),
          10,
        ),
        maxAttemptsPerHour: parseInt(
          this.configService.get<string>('OTP_MAX_ATTEMPTS_PER_HOUR', '10'),
          10,
        ),
        expiryMinutes: parseInt(this.configService.get<string>('OTP_EXPIRY_MINUTES', '10'), 10),
      },
      isProduction,
      isDevelopment: !isProduction,
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): EmailConfig {
    return this.config;
  }

  /**
   * Check if SMTP is fully configured
   */
  isSmtpConfigured(): boolean {
    const { smtp } = this.config;
    return !!(smtp.host && smtp.fromEmail);
  }

  /**
   * Get OTP configuration
   */
  getOtpConfig(): EmailConfig['otp'] {
    return this.config.otp;
  }

  /**
   * Check if email sending is enabled
   */
  isEmailEnabled(): boolean {
    if (this.config.provider === 'console') {
      return true; // Console is always "enabled" for logging
    }
    if (this.config.provider === 'smtp') {
      return this.isSmtpConfigured();
    }
    // Auto mode
    return true;
  }

  /**
   * Get the effective provider that will be used
   */
  getEffectiveProvider(): 'smtp' | 'console' {
    if (this.config.provider === 'smtp') {
      return 'smtp';
    }
    if (this.config.provider === 'console') {
      return 'console';
    }
    // Auto mode: use SMTP if configured
    return this.isSmtpConfigured() ? 'smtp' : 'console';
  }

  /**
   * Validate the configuration
   */
  validate(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { provider, smtp, isProduction } = this.config;

    // Production-specific validations
    if (isProduction) {
      if (provider === 'console') {
        warnings.push('Using console email provider in production - emails will not be delivered');
      }

      if (provider === 'smtp' || provider === 'auto') {
        if (!smtp.host) {
          errors.push('SMTP_HOST is required in production when using SMTP provider');
        }
        if (!smtp.fromEmail) {
          errors.push('SMTP_FROM_EMAIL is required in production');
        }
        if (!this.isValidEmail(smtp.fromEmail)) {
          errors.push('SMTP_FROM_EMAIL must be a valid email address');
        }
      }
    }

    // General validations
    if (smtp.port < 1 || smtp.port > 65535) {
      errors.push('SMTP_PORT must be between 1 and 65535');
    }

    if (smtp.host && !smtp.fromEmail) {
      warnings.push('SMTP_HOST is set but SMTP_FROM_EMAIL is missing');
    }

    // OTP config validation
    if (this.config.otp.resendCooldownSeconds < 30) {
      warnings.push('OTP_RESEND_COOLDOWN_SECONDS is very low (< 30 seconds)');
    }

    if (this.config.otp.maxAttemptsPerHour < 3) {
      warnings.push('OTP_MAX_ATTEMPTS_PER_HOUR is very restrictive (< 3)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
