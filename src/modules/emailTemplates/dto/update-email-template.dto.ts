import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

const TEMPLATE_KEY_SNAKE_CASE = /^[a-z]+(?:_[a-z]+)*$/;

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    description:
      'Unique template key. Lowercase snake_case only. Note: rename is blocked (409) for system templates because email.service.ts references them by literal.',
    example: 'application_approved',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Template key must be at least 2 characters' })
  @MaxLength(100, { message: 'Template key must not exceed 100 characters' })
  @Matches(TEMPLATE_KEY_SNAKE_CASE, {
    message:
      'Template key must be lowercase snake_case (letters and single underscores only, e.g. otp_verification)',
  })
  templateKey?: string;

  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Application submission confirmation',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Subject must be at least 2 characters' })
  @MaxLength(500, { message: 'Subject must not exceed 500 characters' })
  subject?: string;

  @ApiPropertyOptional({
    description: 'HTML body content',
    example: '<p>Updated HTML content</p>',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'HTML body cannot be empty' })
  @MaxLength(50000, { message: 'HTML body must not exceed 50000 characters' })
  bodyHtml?: string;

  @ApiPropertyOptional({
    description: 'Plain text body content',
    example: 'Updated plain text content',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000, { message: 'Text body must not exceed 50000 characters' })
  bodyText?: string;

  @ApiPropertyOptional({
    description: 'Admin-facing annotation explaining when this template fires',
    example: 'Sent when an application is approved by an admin reviewer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
