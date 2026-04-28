import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * `templateKey` is a machine join key looked up at runtime by
 * `email.service.ts`. Restricting to lowercase snake_case keeps the
 * key URL/log-safe and matches the convention used everywhere else in
 * the codebase (visa types, audit action keys, hardcoded literals like
 * `otp_verification`, `application_status_update`).
 */
const TEMPLATE_KEY_SNAKE_CASE = /^[a-z]+(?:_[a-z]+)*$/;

export class CreateEmailTemplateDto {
  @ApiProperty({
    description:
      'Unique template key. Lowercase snake_case only (e.g. otp_verification, application_submitted).',
    example: 'application_submitted',
  })
  @IsString()
  @MinLength(2, { message: 'Template key must be at least 2 characters' })
  @MaxLength(100, { message: 'Template key must not exceed 100 characters' })
  @Matches(TEMPLATE_KEY_SNAKE_CASE, {
    message:
      'Template key must be lowercase snake_case (letters and single underscores only, e.g. otp_verification)',
  })
  templateKey: string;

  @ApiProperty({
    description: 'Email subject line. Supports template variables like {{status}}.',
    example: 'Your application has been submitted',
  })
  @IsString()
  @MinLength(2, { message: 'Subject must be at least 2 characters' })
  @MaxLength(500, { message: 'Subject must not exceed 500 characters' })
  subject: string;

  @ApiProperty({
    description:
      'HTML body content. Supports template variables like {{fullName}}, {{otpCode}}, {{applicationRef}}.',
    example: '<p>Hello {{fullName}}, your application is submitted.</p>',
  })
  @IsString()
  @MinLength(1, { message: 'HTML body is required' })
  @MaxLength(50000, { message: 'HTML body must not exceed 50000 characters' })
  bodyHtml: string;

  @ApiPropertyOptional({
    description: 'Plain text body content (fallback for non-HTML clients)',
    example: 'Hello {{fullName}}, your application is submitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000, { message: 'Text body must not exceed 50000 characters' })
  bodyText?: string;

  @ApiPropertyOptional({
    description:
      'Admin-facing annotation explaining when this template fires (e.g. "Sent when user requests OTP during portal login")',
    example: 'Sent when an application status changes to APPROVED, REJECTED, or PROCESSING',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
