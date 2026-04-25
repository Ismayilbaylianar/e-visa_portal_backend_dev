import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Template variables that can be used in email templates
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Rendered template result
 */
export interface RenderedTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Template rendering result with validation info
 */
export interface TemplateRenderResult {
  success: boolean;
  rendered?: RenderedTemplate;
  error?: string;
  missingVariables?: string[];
}

/**
 * Required variables for each default template
 */
const TEMPLATE_REQUIRED_VARIABLES: Record<string, string[]> = {
  otp_verification: ['otpCode', 'expiryMinutes'],
  generic_notification: ['subject', 'message'],
  application_status_update: ['applicationRef', 'status'],
  invite_email: ['recipientName', 'inviterName', 'inviteLink', 'expiryDays'],
  payment_confirmation: ['paymentRef', 'amount', 'currency', 'applicationRef'],
};

/**
 * Email Template Rendering Service
 *
 * Handles rendering of email templates with variable substitution.
 * Supports both:
 * - Database templates (EmailTemplate model)
 * - Default fallback templates for essential system emails
 */
@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Render a template by key with provided variables
   *
   * @param templateKey - The unique template key
   * @param variables - Variables to substitute in the template
   * @returns Rendered template or null if not found
   */
  async render(
    templateKey: string,
    variables: TemplateVariables,
  ): Promise<RenderedTemplate | null> {
    const result = await this.renderWithValidation(templateKey, variables);
    return result.success ? result.rendered! : null;
  }

  /**
   * Render a template with validation and detailed error information
   *
   * @param templateKey - The unique template key
   * @param variables - Variables to substitute in the template
   * @returns Detailed render result with validation info
   */
  async renderWithValidation(
    templateKey: string,
    variables: TemplateVariables,
  ): Promise<TemplateRenderResult> {
    // Try to get template from database first
    const dbTemplate = await this.getDbTemplate(templateKey);

    if (dbTemplate) {
      const rendered = this.renderTemplate(
        dbTemplate.subject,
        dbTemplate.bodyHtml,
        dbTemplate.bodyText,
        variables,
      );
      return { success: true, rendered };
    }

    // Fall back to default templates for essential system emails
    const defaultTemplate = this.getDefaultTemplate(templateKey);
    if (!defaultTemplate) {
      this.logger.warn(`Email template not found: ${templateKey}`);
      return {
        success: false,
        error: `Template not found: ${templateKey}`,
      };
    }

    // Validate required variables for default templates
    const requiredVars = TEMPLATE_REQUIRED_VARIABLES[templateKey] || [];
    const missingVars = this.validateRequiredVariables(requiredVars, variables);

    if (missingVars.length > 0) {
      this.logger.warn(
        `Missing required variables for template ${templateKey}: ${missingVars.join(', ')}`,
      );
      return {
        success: false,
        error: `Missing required variables: ${missingVars.join(', ')}`,
        missingVariables: missingVars,
      };
    }

    const rendered = this.renderTemplate(
      defaultTemplate.subject,
      defaultTemplate.html,
      defaultTemplate.text,
      variables,
    );

    return { success: true, rendered };
  }

  /**
   * Validate that all required variables are provided
   */
  private validateRequiredVariables(
    required: string[],
    provided: TemplateVariables,
  ): string[] {
    const missing: string[] = [];
    for (const varName of required) {
      if (provided[varName] === undefined || provided[varName] === null) {
        missing.push(varName);
      }
    }
    return missing;
  }

  /**
   * Get required variables for a template
   */
  getRequiredVariables(templateKey: string): string[] {
    return TEMPLATE_REQUIRED_VARIABLES[templateKey] || [];
  }

  /**
   * Get template from database
   */
  private async getDbTemplate(
    templateKey: string,
  ): Promise<{ subject: string; bodyHtml: string; bodyText: string | null } | null> {
    try {
      const template = await this.prisma.emailTemplate.findFirst({
        where: {
          templateKey,
          isActive: true,
          deletedAt: null,
        },
        select: {
          subject: true,
          bodyHtml: true,
          bodyText: true,
        },
      });

      return template;
    } catch (error) {
      this.logger.error(`Error fetching template ${templateKey}: ${error}`);
      return null;
    }
  }

  /**
   * Get default fallback template for essential system emails
   */
  private getDefaultTemplate(
    templateKey: string,
  ): { subject: string; html: string; text: string } | null {
    const templates: Record<string, { subject: string; html: string; text: string }> = {
      // OTP Verification Email
      otp_verification: {
        subject: 'Your Verification Code - {{otpCode}}',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">E-Visa Portal</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
    <p>Hello,</p>
    <p>Your one-time verification code is:</p>
    <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
      {{otpCode}}
    </div>
    <p>This code will expire in <strong>{{expiryMinutes}} minutes</strong>.</p>
    <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from E-Visa Portal. Please do not reply to this email.</p>
  </div>
</body>
</html>
`,
        text: `Your E-Visa Portal verification code is: {{otpCode}}\n\nThis code will expire in {{expiryMinutes}} minutes.\n\nIf you didn't request this code, please ignore this email.`,
      },

      // Generic Notification Email
      generic_notification: {
        subject: '{{subject}}',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">E-Visa Portal</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <p>{{message}}</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from E-Visa Portal.</p>
  </div>
</body>
</html>
`,
        text: `{{message}}\n\n---\nThis is an automated message from E-Visa Portal.`,
      },

      // Application Status Update Email
      application_status_update: {
        subject: 'Application Status Update - {{applicationRef}}',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">E-Visa Portal</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Application Status Update</h2>
    <p>Hello,</p>
    <p>Your visa application <strong>{{applicationRef}}</strong> status has been updated.</p>
    <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>New Status:</strong> {{status}}</p>
    </div>
    {{#if notes}}
    <p><strong>Notes:</strong> {{notes}}</p>
    {{/if}}
    <p>You can track your application status at any time using your tracking number.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from E-Visa Portal.</p>
  </div>
</body>
</html>
`,
        text: `Application Status Update\n\nYour visa application {{applicationRef}} status has been updated.\n\nNew Status: {{status}}\n\n{{#if notes}}Notes: {{notes}}{{/if}}\n\n---\nThis is an automated message from E-Visa Portal.`,
      },

      // Invite Email (for future use)
      invite_email: {
        subject: 'You are invited to E-Visa Portal',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">E-Visa Portal</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">You're Invited!</h2>
    <p>Hello {{recipientName}},</p>
    <p>{{inviterName}} has invited you to join E-Visa Portal.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{inviteLink}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px;">This invitation will expire in {{expiryDays}} days.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from E-Visa Portal.</p>
  </div>
</body>
</html>
`,
        text: `You're Invited!\n\nHello {{recipientName}},\n\n{{inviterName}} has invited you to join E-Visa Portal.\n\nAccept your invitation: {{inviteLink}}\n\nThis invitation will expire in {{expiryDays}} days.\n\n---\nThis is an automated message from E-Visa Portal.`,
      },

      // Payment Confirmation Email
      payment_confirmation: {
        subject: 'Payment Confirmation - {{paymentRef}}',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Confirmed</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Thank You for Your Payment!</h2>
    <p>Hello,</p>
    <p>Your payment has been successfully processed.</p>
    <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Reference:</strong> {{paymentRef}}</p>
      <p style="margin: 5px 0;"><strong>Amount:</strong> {{amount}} {{currency}}</p>
      <p style="margin: 5px 0;"><strong>Application:</strong> {{applicationRef}}</p>
    </div>
    <p>Your application is now being processed.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated message from E-Visa Portal.</p>
  </div>
</body>
</html>
`,
        text: `Payment Confirmed!\n\nYour payment has been successfully processed.\n\nReference: {{paymentRef}}\nAmount: {{amount}} {{currency}}\nApplication: {{applicationRef}}\n\nYour application is now being processed.\n\n---\nThis is an automated message from E-Visa Portal.`,
      },
    };

    return templates[templateKey] || null;
  }

  /**
   * Render a template string with variable substitution
   */
  private renderTemplate(
    subject: string,
    html: string,
    text: string | null | undefined,
    variables: TemplateVariables,
  ): RenderedTemplate {
    return {
      subject: this.substituteVariables(subject, variables),
      html: this.substituteVariables(html, variables),
      text: text ? this.substituteVariables(text, variables) : undefined,
    };
  }

  /**
   * Simple variable substitution using {{variable}} syntax
   */
  private substituteVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace all {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }

    // Handle simple conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        return variables[varName] ? content : '';
      },
    );

    return result;
  }

  /**
   * Get list of available default template keys
   */
  getAvailableDefaultTemplates(): string[] {
    return [
      'otp_verification',
      'generic_notification',
      'application_status_update',
      'invite_email',
      'payment_confirmation',
    ];
  }
}
