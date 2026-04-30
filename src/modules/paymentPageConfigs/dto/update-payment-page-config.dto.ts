import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Forward-compat slot for the advanced section builder UI (Sprint 4).
 * Kept in the DTO + schema so existing rows / future builder ticket
 * continue to round-trip cleanly. Module 5 admin UI does not surface
 * sectionsJson editing yet.
 */
export class PaymentPageFieldDto {
  @ApiPropertyOptional({ description: 'Field key', example: 'notes' })
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @ApiPropertyOptional({ description: 'Field type', example: 'textarea' })
  @IsOptional()
  @IsString()
  fieldType?: string;

  @ApiPropertyOptional({ description: 'Field label', example: 'Notes' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Whether field is required', example: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class PaymentPageSectionDto {
  @ApiPropertyOptional({ description: 'Section key', example: 'summary' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ description: 'Section title', example: 'Payment Summary' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Section fields', type: [PaymentPageFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentPageFieldDto)
  fields?: PaymentPageFieldDto[];
}

export class UpdatePaymentPageConfigDto {
  // ============================================================
  // Content
  // ============================================================

  @ApiPropertyOptional({
    description: 'Page title shown to applicants',
    example: 'Complete Your Payment',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Page description / sub-headline',
    example: 'Secure payment for your visa application.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Help text shown near the support contact',
    example: 'Need help? Contact support@example.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Support text must not exceed 500 characters' })
  supportText?: string;

  @ApiPropertyOptional({
    description: 'Small footer note rendered at the bottom of the page',
    example: 'All transactions are processed securely.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Footer note must not exceed 500 characters' })
  footerNote?: string;

  // ============================================================
  // Layout
  // ============================================================

  @ApiPropertyOptional({
    description: 'Show Visa / Mastercard / Amex card brand logos',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showCardLogos?: boolean;

  @ApiPropertyOptional({
    description: 'Show PCI / SSL / lock-icon trust badges',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showSecurityBadges?: boolean;

  // ============================================================
  // Behavior
  // ============================================================

  @ApiPropertyOptional({
    description: 'Primary CTA button text',
    example: 'Pay Now',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Button text must be at least 2 characters' })
  @MaxLength(60, { message: 'Button text must not exceed 60 characters' })
  primaryButtonText?: string;

  @ApiPropertyOptional({
    description:
      'Minutes before the unpaid-session warning fires on the public payment page (1-30)',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Timeout warning must be at least 1 minute' })
  @Max(30, { message: 'Timeout warning must not exceed 30 minutes' })
  timeoutWarningMinutes?: number;

  @ApiPropertyOptional({
    description: 'Whether the terms acceptance checkbox blocks submission',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  termsCheckboxRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Label rendered next to the terms checkbox',
    example: 'I agree to the terms and privacy policy.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Terms checkbox text must not exceed 500 characters' })
  termsCheckboxText?: string;

  // ============================================================
  // Forward-compat slot (advanced builder, Sprint 4)
  // ============================================================

  @ApiPropertyOptional({
    description:
      'Page sections configuration (JSON). Edited via the Sprint 4 advanced section builder; not surfaced in the Module 5 UI.',
    type: [PaymentPageSectionDto],
    example: [
      {
        key: 'summary',
        title: 'Payment Summary',
        fields: [{ fieldKey: 'notes', fieldType: 'textarea', label: 'Notes', isRequired: false }],
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentPageSectionDto)
  sectionsJson?: PaymentPageSectionDto[];

  @ApiPropertyOptional({
    description: 'Whether the config is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
