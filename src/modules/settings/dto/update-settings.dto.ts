import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEmail,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

/**
 * UpdateSettingsDto — partial update of the singleton row.
 *
 * Optional URL fields (logoUrl / faviconUrl / termsUrl / privacyUrl /
 * siteUrl) accept empty string to clear the value, otherwise must be a
 * valid URL. The `ValidateIf((_, v) => v != null && v !== '')` pattern
 * skips IsUrl when the admin sends '' (intentional clear) or null.
 */
export class UpdateSettingsDto {
  // ============================================================
  // General
  // ============================================================

  @ApiPropertyOptional({ description: 'Site name', example: 'E-Visa Portal' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Site name must be at least 2 characters' })
  @MaxLength(200, { message: 'Site name must not exceed 200 characters' })
  siteName?: string;

  @ApiPropertyOptional({
    description: 'Public site URL',
    example: 'https://evisa.example.com',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'Site URL must be a valid URL' })
  @MaxLength(500, { message: 'Site URL must not exceed 500 characters' })
  siteUrl?: string;

  @ApiPropertyOptional({
    description: 'Support email address',
    example: 'support@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Support email must not exceed 255 characters' })
  supportEmail?: string;

  // ============================================================
  // Payment
  // ============================================================

  @ApiPropertyOptional({
    description: 'Default currency code (ISO 4217 3-letter)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency code must be 3 uppercase letters (ISO 4217)',
  })
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Payment timeout in hours (1-72)', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Payment timeout must be at least 1 hour' })
  @Max(72, { message: 'Payment timeout must not exceed 72 hours (3 days)' })
  paymentTimeoutHours?: number;

  // ============================================================
  // Email (informational — runtime cutover Sprint 5)
  // ============================================================

  @ApiPropertyOptional({
    description: 'SMTP From address (informational until Sprint 5 cutover)',
    example: 'no-reply@example.com',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsEmail({}, { message: 'SMTP From address must be a valid email' })
  @MaxLength(255)
  smtpFromAddress?: string;

  @ApiPropertyOptional({
    description: 'SMTP From display name',
    example: 'E-Visa Portal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'SMTP From name must not exceed 200 characters' })
  smtpFromName?: string;

  @ApiPropertyOptional({
    description: 'Whether transactional emails are sent',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  // ============================================================
  // Application (informational — runtime cutover Sprint 5)
  // ============================================================

  @ApiPropertyOptional({
    description:
      'Application code format template (informational until Sprint 5 cutover)',
    example: 'EV-{YYYY}-{NNNN}',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Application code format must be at least 3 characters' })
  @MaxLength(100, { message: 'Application code format must not exceed 100 characters' })
  applicationCodeFormat?: string;

  @ApiPropertyOptional({
    description: 'Maximum applicants per application (1-20)',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Max applicants must be at least 1' })
  @Max(20, { message: 'Max applicants must not exceed 20' })
  maxApplicantsPerApplication?: number;

  @ApiPropertyOptional({
    description: 'Allow a single application to mix multiple visa types',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMultipleVisaTypes?: boolean;

  // ============================================================
  // Maintenance
  // ============================================================

  @ApiPropertyOptional({
    description: 'Whether maintenance mode is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({
    description: 'Banner message shown to public visitors during maintenance',
    example: 'We are upgrading the system. Service will resume at 02:00 UTC.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Maintenance message must not exceed 2000 characters' })
  maintenanceMessage?: string;

  // ============================================================
  // Branding
  // ============================================================

  @ApiPropertyOptional({
    description:
      'Public logo URL. Consumed by the Sprint 4 frontend header — admin uploads logo elsewhere, paste the resulting URL here.',
    example: 'https://cdn.example.com/logo.svg',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Favicon URL',
    example: 'https://cdn.example.com/favicon.ico',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'Favicon URL must be a valid URL' })
  @MaxLength(500)
  faviconUrl?: string;

  @ApiPropertyOptional({
    description: 'Google Analytics measurement ID',
    example: 'G-XXXXXXXXXX',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, {
    message: 'Google Analytics ID must not exceed 50 characters',
  })
  googleAnalyticsId?: string;

  // ============================================================
  // Legal
  // ============================================================

  @ApiPropertyOptional({
    description: 'Terms of Service URL',
    example: 'https://evisa.example.com/terms',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'Terms URL must be a valid URL' })
  @MaxLength(500)
  termsUrl?: string;

  @ApiPropertyOptional({
    description: 'Privacy Policy URL',
    example: 'https://evisa.example.com/privacy',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'Privacy URL must be a valid URL' })
  @MaxLength(500)
  privacyUrl?: string;
}
