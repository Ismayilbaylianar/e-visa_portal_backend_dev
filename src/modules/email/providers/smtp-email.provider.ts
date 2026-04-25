import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailProvider, EmailMessage, EmailSendResult } from './email-provider.interface';

/**
 * SMTP Email Provider
 *
 * Production-ready SMTP email provider using nodemailer.
 * Configured via environment variables:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_SECURE (true for 465, false for other ports)
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM_EMAIL
 * - SMTP_FROM_NAME
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider, OnModuleInit {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  readonly providerName = 'smtp';

  private transporter: Transporter | null = null;
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private configured = false;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('SMTP_HOST', '');
    this.port = this.configService.get<number>('SMTP_PORT', 587);
    this.secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    this.user = this.configService.get<string>('SMTP_USER', '');
    this.pass = this.configService.get<string>('SMTP_PASS', '');
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL', '');
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME', 'E-Visa Portal');
  }

  async onModuleInit(): Promise<void> {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    if (!this.host || !this.fromEmail) {
      this.logger.warn('SMTP configuration incomplete - email sending will be disabled');
      this.configured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth:
          this.user && this.pass
            ? {
                user: this.user,
                pass: this.pass,
              }
            : undefined,
        tls: {
          rejectUnauthorized: this.configService.get<string>('NODE_ENV') === 'production',
        },
      });

      // Verify connection
      await this.transporter.verify();
      this.configured = true;
      this.logger.log(`SMTP transporter initialized: ${this.host}:${this.port}`);
    } catch (error) {
      this.configured = false;
      this.logger.error(`Failed to initialize SMTP transporter: ${error}`);
    }
  }

  isConfigured(): boolean {
    return this.configured && this.transporter !== null;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SMTP provider not configured',
      };
    }

    const from = message.from || `"${this.fromName}" <${this.fromEmail}>`;

    try {
      const info = await this.transporter!.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
      });

      this.logger.log(`Email sent via SMTP: ${info.messageId} to ${message.to}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      this.logger.error(`SMTP send failed to ${message.to}: ${error.message}`);

      return {
        success: false,
        error: error.message || 'SMTP send failed',
      };
    }
  }
}
