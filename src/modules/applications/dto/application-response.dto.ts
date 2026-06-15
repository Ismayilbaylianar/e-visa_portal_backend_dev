import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';

export class PortalIdentityDto {
  @ApiProperty({ description: 'Portal identity ID' })
  id: string;

  @ApiProperty({ description: 'Portal identity email' })
  email: string;
}

export class CountryDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'Country slug' })
  slug: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;
}

export class VisaTypeDto {
  @ApiProperty({ description: 'Visa type ID' })
  id: string;

  @ApiProperty({ description: 'Visa purpose' })
  purpose: string;

  @ApiProperty({ description: 'Validity in days' })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days' })
  maxStay: number;

  @ApiProperty({
    description:
      'Entry label for THIS application (the chosen entry; per-entry now, not a flat column)',
  })
  entries: string;

  @ApiProperty({ description: 'Display label' })
  label: string;
}

/**
 * Entries feature (Stage 4) — the entry the customer chose at apply
 * time. Surfaced so admin list/detail + the apply review can show the
 * exact entry (label + its validity / max stay).
 */
export class ApplicationVisaTypeEntryDto {
  @ApiProperty({ description: 'Visa type entry ID' })
  id: string;

  @ApiProperty({ description: 'Free-text entry label' })
  entryLabel: string;

  @ApiProperty({ description: 'Validity in days for this entry' })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days for this entry' })
  maxStayDays: number;
}

export class TemplateDto {
  @ApiProperty({ description: 'Template ID' })
  id: string;

  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiProperty({ description: 'Template key' })
  key: string;

  @ApiProperty({ description: 'Template version' })
  version: number;
}

/**
 * Payment row embedded on the portal getApplication response. The
 * customer payment page reads this to resolve the pending `paymentId`
 * (so the mock confirm step can run) and the payment-window `expiresAt`
 * (so the "Time Remaining" countdown can tick). Only the portal
 * getApplication path populates this; other paths omit it.
 */
export class ApplicationPaymentDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Payment status (PENDING/CREATED/PAID/…)' })
  paymentStatus: string;

  @ApiProperty({ description: 'Provider key (e.g. mockProvider)' })
  paymentProviderKey: string;

  @ApiProperty({ description: 'Total amount (decimal string)' })
  totalAmount: string;

  @ApiProperty({ description: 'Payable amount (decimal string)' })
  payableAmount: string;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  currencyCode: string;

  @ApiPropertyOptional({ description: 'Payment-window expiry (3h deadline)' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'When the payment was marked paid' })
  paidAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export class ApplicantDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiPropertyOptional({ description: 'Applicant phone' })
  phone?: string;

  @ApiProperty({ description: 'Form data (JSON)' })
  formDataJson: any;

  @ApiProperty({ description: 'Applicant status' })
  status: string;

  @ApiPropertyOptional({ description: 'Application code' })
  applicationCode?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ApplicationResponseDto {
  @ApiProperty({
    description: 'Application ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  /**
   * M11.10 (BUG 4) — Booking-level reference code shared by every
   * applicant on this booking. Customer-facing surfaces (success
   * page, /track, /me, post-payment email) lead with this; the
   * per-applicant `applicants[].applicationCode` is shown alongside.
   */
  @ApiProperty({
    description: 'Booking reference code (REF-YYYY-NNNNNN)',
    example: 'REF-2026-000001',
    required: false,
  })
  referenceCode?: string | null;

  @ApiProperty({
    description: 'Portal identity ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  portalIdentityId: string;

  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  visaTypeId: string;

  @ApiPropertyOptional({
    description: 'Visa type entry ID — the entry chosen at apply time (Stage 4)',
    example: '550e8400-e29b-41d4-a716-446655440006',
    nullable: true,
  })
  visaTypeEntryId?: string | null;

  @ApiProperty({
    description: 'Template ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  templateId: string;

  @ApiProperty({
    description: 'Template binding ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  templateBindingId: string;

  @ApiProperty({
    description: 'Total fee amount',
    example: '150.00',
  })
  totalFeeAmount: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Whether expedited processing is requested',
    example: false,
  })
  expedited: boolean;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment deadline',
  })
  paymentDeadlineAt?: Date;

  @ApiProperty({
    description: 'Resume token for continuing application',
    example: 'abc123xyz789',
  })
  resumeToken: string;

  @ApiProperty({
    description: 'Current application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.DRAFT,
  })
  currentStatus: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'When the application was reviewed',
  })
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: 'ID of the admin user who reviewed the application',
  })
  reviewedByUserId?: string;

  @ApiPropertyOptional({
    description: 'Admin note on the application',
  })
  adminNote?: string;

  @ApiPropertyOptional({
    description: 'Rejection reason (if rejected)',
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: 'List of requested document type keys',
    type: [String],
  })
  requestedDocumentTypes?: string[];

  /**
   * Module 9 — admin-set SLA estimate for the customer. null when
   * the admin hasn't set one yet. `estimatedTimeUpdatedAt` reflects
   * the last change; the full change log lives at
   * /admin/applications/:id/estimated-time-changes.
   */
  @ApiPropertyOptional({ description: 'Estimated processing days (1-365)', nullable: true })
  estimatedProcessingDays?: number | null;

  @ApiPropertyOptional({ description: 'When the estimate was last changed', nullable: true })
  estimatedTimeUpdatedAt?: Date | null;

  @ApiPropertyOptional({
    type: PortalIdentityDto,
    description: 'Portal identity details',
  })
  portalIdentity?: PortalIdentityDto;

  @ApiPropertyOptional({
    type: CountryDto,
    description: 'Nationality country details',
  })
  nationalityCountry?: CountryDto;

  @ApiPropertyOptional({
    type: CountryDto,
    description: 'Destination country details',
  })
  destinationCountry?: CountryDto;

  @ApiPropertyOptional({
    type: VisaTypeDto,
    description: 'Visa type details',
  })
  visaType?: VisaTypeDto;

  @ApiPropertyOptional({
    type: ApplicationVisaTypeEntryDto,
    description: 'Chosen visa type entry (Stage 4)',
  })
  visaTypeEntry?: ApplicationVisaTypeEntryDto;

  @ApiPropertyOptional({
    type: TemplateDto,
    description: 'Template details',
  })
  template?: TemplateDto;

  @ApiPropertyOptional({
    type: [ApplicantDto],
    description: 'Application applicants',
  })
  applicants?: ApplicantDto[];

  @ApiPropertyOptional({
    type: [ApplicationPaymentDto],
    description:
      'Payment rows (portal getApplication only). Lets the payment page resolve the pending paymentId + the countdown deadline.',
  })
  payments?: ApplicationPaymentDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
