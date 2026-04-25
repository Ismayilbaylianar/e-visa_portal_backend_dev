import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards';
import { RequirePermissions } from '@/common/decorators';
import { EmailService } from './email.service';
import { EmailLogService } from './email-log.service';
import { EmailConfigService } from './email-config.service';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for test email request
 */
class SendTestEmailDto {
  @ApiProperty({
    description: 'Recipient email address for test',
    example: 'admin@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to: string;
}

/**
 * Email statistics response
 */
class EmailStatisticsDto {
  @ApiProperty({ description: 'Total emails sent' })
  total: number;

  @ApiProperty({ description: 'Successfully sent emails' })
  sent: number;

  @ApiProperty({ description: 'Failed emails' })
  failed: number;

  @ApiProperty({ description: 'Pending emails' })
  pending: number;
}

/**
 * Email status response
 */
class EmailStatusDto {
  @ApiProperty({ description: 'Current email provider' })
  provider: string;

  @ApiProperty({ description: 'Whether provider is configured' })
  isConfigured: boolean;

  @ApiProperty({ description: 'Whether running in development mode' })
  isDevelopment: boolean;
}

/**
 * Test email result response
 */
class TestEmailResultDto {
  @ApiProperty({ description: 'Whether test email was sent successfully' })
  success: boolean;

  @ApiProperty({ description: 'Message ID if successful', required: false })
  messageId?: string;

  @ApiProperty({ description: 'Error message if failed', required: false })
  error?: string;

  @ApiProperty({ description: 'Provider used for sending' })
  provider: string;
}

/**
 * Email Admin Controller
 *
 * Provides administrative utilities for email system management:
 * - Send test emails to verify configuration
 * - Check email service status
 * - View email statistics
 *
 * All endpoints require admin authentication and appropriate permissions.
 */
@ApiTags('Email Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/email')
export class EmailAdminController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
    private readonly emailConfigService: EmailConfigService,
  ) {}

  /**
   * Send a test email to verify email configuration
   *
   * This endpoint allows admins to test the email system by sending
   * a simple test email. Useful for:
   * - Verifying SMTP configuration
   * - Testing email delivery
   * - Debugging email issues
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings.update')
  @ApiOperation({
    summary: 'Send test email',
    description: 'Send a test email to verify email configuration is working correctly',
  })
  @ApiResponse({
    status: 200,
    description: 'Test email result',
    type: TestEmailResultDto,
  })
  async sendTestEmail(@Body() dto: SendTestEmailDto): Promise<TestEmailResultDto> {
    const result = await this.emailService.sendTestEmail(dto.to);

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      provider: result.provider,
    };
  }

  /**
   * Get email service status
   *
   * Returns current state of the email system including
   * which provider is active and whether it's configured.
   */
  @Get('status')
  @RequirePermissions('settings.read')
  @ApiOperation({
    summary: 'Get email service status',
    description: 'Returns current email service configuration and status',
  })
  @ApiResponse({
    status: 200,
    description: 'Email service status',
    type: EmailStatusDto,
  })
  getStatus(): EmailStatusDto {
    return this.emailService.getStatus();
  }

  /**
   * Get email statistics
   *
   * Returns aggregate statistics about email sending activity.
   * Useful for monitoring email health and debugging delivery issues.
   */
  @Get('statistics')
  @RequirePermissions('settings.read')
  @ApiOperation({
    summary: 'Get email statistics',
    description: 'Returns email sending statistics for monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'Email statistics',
    type: EmailStatisticsDto,
  })
  async getStatistics(): Promise<EmailStatisticsDto> {
    // Get statistics for the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.emailLogService.getStatistics(since);
  }

  /**
   * Get recent email failures
   *
   * Returns list of recent failed email attempts for debugging.
   */
  @Get('failures')
  @RequirePermissions('settings.read')
  @ApiOperation({
    summary: 'Get recent email failures',
    description: 'Returns recent failed email attempts for debugging',
  })
  @ApiResponse({
    status: 200,
    description: 'List of failed emails',
  })
  async getRecentFailures(): Promise<any[]> {
    return this.emailLogService.getRecentFailures(50);
  }

  /**
   * Get email configuration validation status
   */
  @Get('config/validate')
  @RequirePermissions('settings.read')
  @ApiOperation({
    summary: 'Validate email configuration',
    description: 'Validates current email configuration and returns any issues',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration validation result',
  })
  validateConfig(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    effectiveProvider: string;
  } {
    const validation = this.emailConfigService.validate();
    return {
      ...validation,
      effectiveProvider: this.emailConfigService.getEffectiveProvider(),
    };
  }
}
