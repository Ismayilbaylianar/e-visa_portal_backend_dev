import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  EmailMessage,
  EMAIL_PROVIDER,
} from './providers/email-provider.interface';
import { EmailTemplateService, TemplateVariables } from './templates/email-template.service';
import { EmailLogService } from './email-log.service';
import { EmailLogStatus } from '@prisma/client';

/**
 * Send options for templated emails
 */
export interface SendTemplatedEmailOptions {
  to: string;
  templateKey: string;
  variables: TemplateVariables;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  // Optional: link to related entity for logging
  relatedEntity?: string;
  relatedEntityId?: string;
}

/**
 * Send options for raw emails
 */
export interface SendRawEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  // For logging purposes
  templateKey?: string;
  relatedEntity?: string;
  relatedEntityId?: string;
}

/**
 * Email Service Result
 */
export interface EmailServiceResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  provider: string;
  logId?: string;
}

/**
 * Main Email Service
 *
 * Provides a high-level interface for sending emails.
 * Features:
 * - Template-based email sending
 * - Raw email sending
 * - Provider-agnostic (uses injected provider)
 * - Graceful error handling
 * - Structured logging
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly isDevelopment: boolean;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly templateService: EmailTemplateService,
    private readonly emailLogService: EmailLogService,
    private readonly configService: ConfigService,
  ) {
    this.isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';
    this.logger.log(
      `Email service initialized with provider: ${this.emailProvider.providerName}`,
    );
  }

  /**
   * Check if email sending is available
   */
  isAvailable(): boolean {
    return this.emailProvider.isConfigured();
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.emailProvider.providerName;
  }

  /**
   * Send an email using a template
   *
   * @param options - Send options including template key and variables
   * @returns Send result
   */
  async sendTemplatedEmail(options: SendTemplatedEmailOptions): Promise<EmailServiceResult> {
    const { to, templateKey, variables, relatedEntity, relatedEntityId, ...rest } = options;

    this.logger.debug(`Rendering template: ${templateKey} for ${to}`);

    // Render template with validation
    const renderResult = await this.templateService.renderWithValidation(templateKey, variables);

    if (!renderResult.success) {
      this.logger.error(`Template rendering failed: ${renderResult.error}`);

      // Log the failure
      const logId = await this.emailLogService.log({
        templateKey,
        recipient: to,
        provider: this.emailProvider.providerName,
        status: EmailLogStatus.FAILED,
        errorMessage: renderResult.error,
        errorCode: renderResult.missingVariables ? 'MISSING_VARIABLES' : 'TEMPLATE_NOT_FOUND',
        relatedEntity,
        relatedEntityId,
      });

      return {
        success: false,
        error: renderResult.error,
        errorCode: renderResult.missingVariables ? 'emailMissingVariables' : 'emailTemplateNotFound',
        provider: this.emailProvider.providerName,
        logId,
      };
    }

    // Send email
    return this.sendRawEmail({
      to,
      subject: renderResult.rendered!.subject,
      html: renderResult.rendered!.html,
      text: renderResult.rendered!.text,
      templateKey,
      relatedEntity,
      relatedEntityId,
      ...rest,
    });
  }

  /**
   * Send a raw email (without template)
   *
   * @param options - Send options
   * @returns Send result
   */
  async sendRawEmail(options: SendRawEmailOptions): Promise<EmailServiceResult> {
    const {
      to,
      subject,
      html,
      text,
      from,
      replyTo,
      cc,
      bcc,
      templateKey,
      relatedEntity,
      relatedEntityId,
    } = options;

    this.logger.debug(`Sending email to ${to}: ${subject}`);

    // Create pending log entry
    const logId = await this.emailLogService.logPending({
      templateKey: templateKey || 'raw_email',
      recipient: to,
      subject,
      provider: this.emailProvider.providerName,
      relatedEntity,
      relatedEntityId,
    });

    if (!this.emailProvider.isConfigured()) {
      this.logger.warn('Email provider not configured, skipping email send');

      await this.emailLogService.markFailed(logId, 'Email provider not configured', 'PROVIDER_NOT_CONFIGURED');

      return {
        success: false,
        error: 'Email provider not configured',
        errorCode: 'emailProviderNotConfigured',
        provider: this.emailProvider.providerName,
        logId,
      };
    }

    const message: EmailMessage = {
      to,
      subject,
      html,
      text,
      from,
      replyTo,
      cc,
      bcc,
    };

    try {
      const result = await this.emailProvider.send(message);

      if (result.success) {
        this.logger.log(`Email sent successfully to ${to} [${result.messageId}]`);
        await this.emailLogService.markSent(logId, result.messageId);
      } else {
        this.logger.error(`Email send failed to ${to}: ${result.error}`);
        await this.emailLogService.markFailed(logId, result.error || 'Send failed', 'SEND_FAILED');
      }

      return {
        ...result,
        provider: this.emailProvider.providerName,
        logId,
      };
    } catch (error: any) {
      this.logger.error(`Unexpected error sending email to ${to}: ${error.message}`);

      await this.emailLogService.markFailed(logId, error.message || 'Unexpected error', 'UNEXPECTED_ERROR');

      return {
        success: false,
        error: error.message || 'Unexpected email send error',
        errorCode: 'emailSendFailed',
        provider: this.emailProvider.providerName,
        logId,
      };
    }
  }

  /**
   * Send OTP verification email
   *
   * Convenience method for sending OTP emails with the standard template.
   *
   * @param to - Recipient email
   * @param otpCode - The OTP code
   * @param expiryMinutes - Minutes until OTP expires
   * @param otpId - Optional OTP record ID for logging
   * @returns Send result
   */
  async sendOtpEmail(
    to: string,
    otpCode: string,
    expiryMinutes: number,
    otpId?: string,
  ): Promise<EmailServiceResult> {
    return this.sendTemplatedEmail({
      to,
      templateKey: 'otp_verification',
      variables: {
        otpCode,
        expiryMinutes,
      },
      relatedEntity: otpId ? 'OtpCode' : undefined,
      relatedEntityId: otpId,
    });
  }

  /**
   * Send generic notification email
   *
   * @param to - Recipient email
   * @param subject - Email subject
   * @param message - Message content
   * @returns Send result
   */
  async sendNotificationEmail(
    to: string,
    subject: string,
    message: string,
  ): Promise<EmailServiceResult> {
    return this.sendTemplatedEmail({
      to,
      templateKey: 'generic_notification',
      variables: {
        subject,
        message,
      },
    });
  }

  /**
   * Send application status update email
   *
   * @param to - Recipient email
   * @param applicationRef - Application reference number
   * @param status - New application status
   * @param notes - Optional notes
   * @returns Send result
   */
  async sendApplicationStatusEmail(
    to: string,
    applicationRef: string,
    status: string,
    notes?: string,
  ): Promise<EmailServiceResult> {
    return this.sendTemplatedEmail({
      to,
      templateKey: 'application_status_update',
      variables: {
        applicationRef,
        status,
        notes: notes || '',
      },
    });
  }

  /**
   * Send payment confirmation email
   *
   * @param to - Recipient email
   * @param paymentRef - Payment reference
   * @param amount - Payment amount
   * @param currency - Currency code
   * @param applicationRef - Related application reference
   * @param paymentId - Optional payment ID for logging
   * @returns Send result
   */
  async sendPaymentConfirmationEmail(
    to: string,
    paymentRef: string,
    amount: number,
    currency: string,
    applicationRef: string,
    paymentId?: string,
  ): Promise<EmailServiceResult> {
    return this.sendTemplatedEmail({
      to,
      templateKey: 'payment_confirmation',
      variables: {
        paymentRef,
        amount: amount.toFixed(2),
        currency,
        applicationRef,
      },
      relatedEntity: paymentId ? 'Payment' : undefined,
      relatedEntityId: paymentId,
    });
  }

  /**
   * Send a test email (for admin verification purposes)
   *
   * This method is intended for admin/support use to verify email configuration.
   * It sends a simple test email to confirm the email system is working.
   *
   * @param to - Recipient email
   * @returns Send result
   */
  async sendTestEmail(to: string): Promise<EmailServiceResult> {
    const timestamp = new Date().toISOString();

    return this.sendTemplatedEmail({
      to,
      templateKey: 'generic_notification',
      variables: {
        subject: 'E-Visa Portal - Email Configuration Test',
        message: `This is a test email from E-Visa Portal to verify email configuration.\n\nSent at: ${timestamp}\nProvider: ${this.emailProvider.providerName}`,
      },
      relatedEntity: 'AdminTest',
      relatedEntityId: timestamp,
    });
  }

  /**
   * Get email service health/status
   *
   * Returns current provider status and configuration state.
   */
  getStatus(): {
    provider: string;
    isConfigured: boolean;
    isDevelopment: boolean;
  } {
    return {
      provider: this.emailProvider.providerName,
      isConfigured: this.emailProvider.isConfigured(),
      isDevelopment: this.isDevelopment,
    };
  }
}
