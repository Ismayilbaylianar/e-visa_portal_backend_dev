import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional } from 'class-validator';

/**
 * Module 8 — Master Data Management Pack.
 *
 * Body for POST /admin/emailTemplates/:templateId/test-send. The
 * recipient is optional — when omitted we fall back to the current
 * admin's own email so they can verify rendering against their own
 * inbox without typing it in. Variables follow the same shape as the
 * preview endpoint and are passed straight through to
 * EmailService.sendTemplatedEmail.
 */
export class TestSendEmailTemplateDto {
  @ApiPropertyOptional({
    description:
      'Recipient email. Defaults to the calling admin’s own email when omitted so the admin can verify rendering against their own inbox.',
    example: 'admin@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'recipientEmail must be a valid email address' })
  recipientEmail?: string;

  @ApiPropertyOptional({
    description: 'Variables to substitute. Same shape as the preview endpoint.',
    example: { otpCode: '123456', expiryMinutes: 5 },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string | number | boolean>;
}

/**
 * Response shape mirrors EmailService.EmailServiceResult fields the
 * admin actually cares about. We surface logId so the admin can look
 * up the EmailLog row in the audit / email log UI to see provider
 * status (queued / sent / failed).
 */
export class TestSendEmailTemplateResponseDto {
  @ApiProperty({ description: 'Whether the send succeeded', example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Email recipient that was actually used.',
    example: 'admin@example.com',
  })
  recipient!: string;

  @ApiProperty({
    description: 'Active provider that handled the send.',
    example: 'smtp',
  })
  provider!: string;

  @ApiPropertyOptional({
    description: 'EmailLog row id (always present for traceability).',
  })
  logId?: string;

  @ApiPropertyOptional({
    description: 'Human-readable error when success=false.',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Stable error code when success=false.',
    example: 'emailMissingVariables',
  })
  errorCode?: string;
}
