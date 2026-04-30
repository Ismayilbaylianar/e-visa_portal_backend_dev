import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentPageConfigResponseDto {
  @ApiProperty({ description: 'Config ID', example: 'uuid' })
  id: string;

  // ============================================================
  // Content
  // ============================================================
  @ApiProperty({ description: 'Page title', example: 'Complete Your Payment' })
  title: string;

  @ApiPropertyOptional({
    description: 'Page description / sub-headline',
    example: 'Secure payment for your visa application.',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Help text near the support contact',
    example: 'Need help? Contact support@example.com',
  })
  supportText?: string;

  @ApiPropertyOptional({
    description: 'Footer note rendered at the bottom',
    example: 'All transactions are processed securely.',
  })
  footerNote?: string;

  // ============================================================
  // Layout
  // ============================================================
  @ApiProperty({ description: 'Show card brand logos', example: true })
  showCardLogos: boolean;

  @ApiProperty({ description: 'Show PCI / SSL trust badges', example: true })
  showSecurityBadges: boolean;

  // ============================================================
  // Behavior
  // ============================================================
  @ApiProperty({ description: 'Primary CTA button text', example: 'Pay Now' })
  primaryButtonText: string;

  @ApiProperty({
    description: 'Minutes before the unpaid-session warning fires (1-30)',
    example: 5,
  })
  timeoutWarningMinutes: number;

  @ApiProperty({
    description: 'Whether the terms acceptance checkbox blocks submission',
    example: false,
  })
  termsCheckboxRequired: boolean;

  @ApiPropertyOptional({
    description: 'Label rendered next to the terms checkbox',
    example: 'I agree to the terms and privacy policy.',
  })
  termsCheckboxText?: string;

  // ============================================================
  // Forward-compat slot (advanced builder, Sprint 4)
  // ============================================================
  @ApiProperty({
    description: 'Page sections configuration (Sprint 4 builder)',
    example: [{ key: 'summary', title: 'Payment Summary', fields: [] }],
  })
  sectionsJson: any;

  @ApiProperty({ description: 'Whether config is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
