import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailMessage, EmailSendResult } from './email-provider.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Console Email Provider
 *
 * Development/local fallback provider that logs emails to console
 * instead of actually sending them. Useful for:
 * - Local development without SMTP setup
 * - Testing email flows
 * - CI/CD environments
 *
 * All emails are "sent" successfully and logged with full details.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);
  readonly providerName = 'console';

  isConfigured(): boolean {
    return true; // Console provider is always configured
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `console-${uuidv4()}`;

    this.logger.log('━'.repeat(60));
    this.logger.log('[CONSOLE EMAIL PROVIDER - Email not actually sent]');
    this.logger.log('━'.repeat(60));
    this.logger.log(`Message ID: ${messageId}`);
    this.logger.log(`To: ${message.to}`);
    this.logger.log(`Subject: ${message.subject}`);
    if (message.from) {
      this.logger.log(`From: ${message.from}`);
    }
    if (message.replyTo) {
      this.logger.log(`Reply-To: ${message.replyTo}`);
    }
    if (message.cc?.length) {
      this.logger.log(`CC: ${message.cc.join(', ')}`);
    }
    if (message.bcc?.length) {
      this.logger.log(`BCC: ${message.bcc.join(', ')}`);
    }
    this.logger.log('─'.repeat(60));
    this.logger.log('HTML Body:');
    this.logger.log(message.html);
    if (message.text) {
      this.logger.log('─'.repeat(60));
      this.logger.log('Text Body:');
      this.logger.log(message.text);
    }
    this.logger.log('━'.repeat(60));

    return {
      success: true,
      messageId,
    };
  }
}
