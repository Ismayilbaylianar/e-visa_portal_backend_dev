import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';

export class MyApplicationCountryDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;
}

export class MyApplicationVisaTypeDto {
  @ApiProperty({ description: 'Visa type ID' })
  id: string;

  @ApiProperty({ description: 'Visa purpose' })
  purpose: string;

  @ApiProperty({ description: 'Display label' })
  label: string;
}

/**
 * M9b — applicant entry on the /me/applications response.
 *
 * `hasIssuedVisa` is the flag the customer-side download button reads
 * to decide whether to render. We derive it server-side rather than
 * making the frontend look at the documents collection directly so
 * the UI doesn't need to know our internal `issued_visa` doc-type
 * convention.
 */
export class MyApplicationApplicantDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiProperty({ description: 'Applicant status' })
  status: string;

  @ApiPropertyOptional({ description: 'Per-applicant application code (set when issued)' })
  applicationCode?: string;

  @ApiProperty({
    description:
      'True when an issued visa PDF exists for this applicant — frontend uses this to render the download button on READY_TO_DOWNLOAD apps.',
  })
  hasIssuedVisa: boolean;

  @ApiPropertyOptional({
    description:
      'Document type keys the customer has already submitted (excludes the internal issued_visa). Lets the resubmit modal show "already uploaded" hints.',
    type: [String],
  })
  uploadedDocumentTypes?: string[];
}

/**
 * M9b — extended application item.
 *
 * Adds: applicationCode (from the main applicant), requestedDocumentTypes
 * (drives the NEED_DOCS card), estimatedProcessingDays + updatedAt
 * (drives the "estimated time" pill), rejectionReason (drives the
 * REJECTED card), adminNote (last admin message — useful when status
 * is NEED_DOCS or REJECTED). All optional so existing callers keep
 * working.
 */
export class MyApplicationItemDto {
  @ApiProperty({
    description: 'Application ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiPropertyOptional({
    description:
      'Customer-facing application code (taken from the main applicant). Empty until issuance assigns one.',
    example: 'EV-2026-001234',
  })
  applicationCode?: string;

  @ApiProperty({
    description: 'Current application status',
    enum: ApplicationStatus,
    example: ApplicationStatus.DRAFT,
  })
  currentStatus: ApplicationStatus;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

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

  @ApiPropertyOptional({
    type: [String],
    description: 'Document type keys the admin has requested. Empty unless status === NEED_DOCS.',
  })
  requestedDocumentTypes?: string[];

  @ApiPropertyOptional({
    description: 'Admin-provided processing estimate in days (1-365)',
    nullable: true,
  })
  estimatedProcessingDays?: number | null;

  @ApiPropertyOptional({ description: 'When the estimate was last set/updated', nullable: true })
  estimatedTimeUpdatedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Reason the application was rejected (only set when status === REJECTED)',
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description:
      'Most recent admin note. Useful for NEED_DOCS apps to show what the reviewer asked for.',
  })
  adminNote?: string;

  @ApiPropertyOptional({
    type: MyApplicationCountryDto,
    description: 'Destination country details',
  })
  destinationCountry?: MyApplicationCountryDto;

  @ApiPropertyOptional({
    type: MyApplicationVisaTypeDto,
    description: 'Visa type details',
  })
  visaType?: MyApplicationVisaTypeDto;

  @ApiPropertyOptional({
    type: [MyApplicationApplicantDto],
    description: 'Application applicants',
  })
  applicants?: MyApplicationApplicantDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class MyApplicationsResponseDto {
  @ApiProperty({
    type: [MyApplicationItemDto],
    description: 'List of user applications',
  })
  items: MyApplicationItemDto[];

  @ApiProperty({
    description: 'Total number of applications',
    example: 5,
  })
  total: number;
}
