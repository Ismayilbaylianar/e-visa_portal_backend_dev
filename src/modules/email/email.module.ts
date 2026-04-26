import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplateService } from './templates/email-template.service';
import { EmailLogService } from './email-log.service';
import { EmailConfigService } from './email-config.service';
import { EmailAdminController } from './email-admin.controller';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';

/**
 * Email Module
 *
 * Provides email sending infrastructure with configurable providers.
 *
 * Provider Selection (via EMAIL_PROVIDER env var):
 * - 'smtp': Use real SMTP sending (requires SMTP_* config)
 * - 'console': Log emails to console (default for development)
 * - 'auto': Use SMTP if configured, otherwise console (default)
 *
 * Environment Variables:
 * - EMAIL_PROVIDER: Provider selection ('smtp', 'console', 'auto')
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use TLS (default: false)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 * - SMTP_FROM_EMAIL: Default sender email
 * - SMTP_FROM_NAME: Default sender name
 */
@Global()
@Module({})
export class EmailModule {
  /**
   * Register the email module
   *
   * Automatically selects the appropriate provider based on configuration.
   */
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      imports: [ConfigModule],
      controllers: [EmailAdminController],
      providers: [
        // Config validation service
        EmailConfigService,

        // Template service
        EmailTemplateService,

        // Email logging service
        EmailLogService,

        // Dynamic provider selection
        {
          provide: EMAIL_PROVIDER,
          useFactory: (configService: ConfigService) => {
            const providerSetting = configService.get<string>('EMAIL_PROVIDER', 'auto');
            const smtpHost = configService.get<string>('SMTP_HOST', '');
            const smtpConfigured = !!smtpHost;
            const nodeEnv = configService.get<string>('NODE_ENV', 'development');
            const isProduction = nodeEnv === 'production';

            let selectedProvider: 'smtp' | 'console';

            if (providerSetting === 'smtp') {
              selectedProvider = 'smtp';
            } else if (providerSetting === 'console') {
              selectedProvider = 'console';
            } else {
              // Auto-select: use SMTP if configured, otherwise console
              // In production, prefer SMTP if available
              if (smtpConfigured) {
                selectedProvider = 'smtp';
              } else if (isProduction) {
                console.warn(
                  '[EmailModule] Warning: SMTP not configured in production. Using console provider.',
                );
                selectedProvider = 'console';
              } else {
                selectedProvider = 'console';
              }
            }

            console.log(`[EmailModule] Using email provider: ${selectedProvider}`);

            if (selectedProvider === 'smtp') {
              return new SmtpEmailProvider(configService);
            } else {
              return new ConsoleEmailProvider();
            }
          },
          inject: [ConfigService],
        },

        // Main email service
        EmailService,
      ],
      exports: [
        EmailService,
        EmailTemplateService,
        EmailLogService,
        EmailConfigService,
        EMAIL_PROVIDER,
      ],
    };
  }
}
