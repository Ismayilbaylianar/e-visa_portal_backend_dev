/**
 * Email sending result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email message parameters
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

/**
 * Email provider interface
 * All email providers must implement this interface
 */
export interface EmailProvider {
  /**
   * Provider identifier
   */
  readonly providerName: string;

  /**
   * Send an email message
   */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Check if the provider is properly configured and ready to send
   */
  isConfigured(): boolean;
}

/**
 * Injection token for email provider
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
