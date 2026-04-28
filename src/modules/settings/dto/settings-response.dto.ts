import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ description: 'Settings ID', example: 'uuid' })
  id: string;

  // ============================================================
  // General
  // ============================================================
  @ApiProperty({ description: 'Site name', example: 'E-Visa Portal' })
  siteName: string;

  @ApiProperty({
    description: 'Public site URL (empty string when unset)',
    example: 'https://evisa.example.com',
  })
  siteUrl: string;

  @ApiProperty({ description: 'Support email', example: 'support@example.com' })
  supportEmail: string;

  // ============================================================
  // Payment
  // ============================================================
  @ApiProperty({ description: 'Default currency code', example: 'USD' })
  defaultCurrency: string;

  @ApiProperty({ description: 'Payment timeout in hours', example: 3 })
  paymentTimeoutHours: number;

  // ============================================================
  // Email (informational — runtime cutover Sprint 5)
  // ============================================================
  @ApiProperty({ description: 'SMTP From address', example: 'no-reply@example.com' })
  smtpFromAddress: string;

  @ApiProperty({ description: 'SMTP From display name', example: 'E-Visa Portal' })
  smtpFromName: string;

  @ApiProperty({
    description: 'Whether transactional emails are sent',
    example: true,
  })
  notificationEmailEnabled: boolean;

  // ============================================================
  // Application (informational — runtime cutover Sprint 5)
  // ============================================================
  @ApiProperty({
    description: 'Application code format template',
    example: 'EV-{YYYY}-{NNNN}',
  })
  applicationCodeFormat: string;

  @ApiProperty({
    description: 'Maximum applicants per application',
    example: 10,
  })
  maxApplicantsPerApplication: number;

  @ApiProperty({
    description: 'Allow a single application to mix multiple visa types',
    example: false,
  })
  allowMultipleVisaTypes: boolean;

  // ============================================================
  // Maintenance
  // ============================================================
  @ApiProperty({
    description: 'Whether maintenance mode is enabled',
    example: false,
  })
  maintenanceMode: boolean;

  @ApiPropertyOptional({
    description: 'Banner message during maintenance',
    example: 'Service paused for upgrade.',
  })
  maintenanceMessage?: string;

  // ============================================================
  // Branding
  // ============================================================
  @ApiPropertyOptional({
    description:
      'Public logo URL — consumed by the Sprint 4 frontend header.',
    example: 'https://cdn.example.com/logo.svg',
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Favicon URL',
    example: 'https://cdn.example.com/favicon.ico',
  })
  faviconUrl?: string;

  @ApiPropertyOptional({
    description: 'Google Analytics measurement ID',
    example: 'G-XXXXXXXXXX',
  })
  googleAnalyticsId?: string;

  // ============================================================
  // Legal
  // ============================================================
  @ApiPropertyOptional({
    description: 'Terms of Service URL',
    example: 'https://evisa.example.com/terms',
  })
  termsUrl?: string;

  @ApiPropertyOptional({
    description: 'Privacy Policy URL',
    example: 'https://evisa.example.com/privacy',
  })
  privacyUrl?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
