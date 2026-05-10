import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatusHistoryItemDto {
  @ApiProperty({ description: 'Previous status', example: 'DRAFT' })
  oldStatus: string;

  @ApiProperty({ description: 'New status', example: 'SUBMITTED' })
  newStatus: string;

  @ApiPropertyOptional({ description: 'Note about the status change' })
  note?: string | null;

  @ApiProperty({ description: 'When the status changed' })
  changedAt: Date;
}

/**
 * M11.10 (BUG 4) — Per-applicant tracking summary, returned both
 * standalone (when /track is queried by APP code) and as a list
 * inside `BookingTrackingResponseDto.applicants` (when /track is
 * queried by REF code).
 */
export class TrackingResponseDto {
  @ApiProperty({
    description: 'Application code',
    example: 'APP-2026-000001',
  })
  applicationCode: string;

  @ApiPropertyOptional({
    description: 'M11.10 — Booking-level reference code that owns this applicant.',
    example: 'REF-2026-000001',
  })
  referenceCode?: string | null;

  @ApiPropertyOptional({
    description: 'M11.11 (BUG H) — Display name from the applicant form (firstName + lastName).',
    example: 'Anar Ismayilbayli',
  })
  fullName?: string | null;

  @ApiProperty({
    description: 'Current applicant status',
    example: 'IN_REVIEW',
  })
  currentStatus: string;

  @ApiProperty({
    description: 'Status change history',
    type: [StatusHistoryItemDto],
  })
  statusHistory: StatusHistoryItemDto[];

  @ApiProperty({
    description: 'Whether result file is available for download',
    example: false,
  })
  resultAvailable: boolean;

  @ApiPropertyOptional({
    description: 'Result file name if available',
  })
  resultFileName?: string | null;
}

/**
 * M11.10 (BUG 4) + M11.11 (BUG H) — Booking-level tracking response.
 * Returned when /track is queried by REF or APP code. Includes
 * destination + visaType + booking-level totals so the customer
 * sees a complete summary, not "Not available".
 */
export class BookingTrackingResponseDto {
  @ApiProperty({ description: 'Booking reference code', example: 'REF-2026-000001' })
  referenceCode: string;

  @ApiProperty({
    description: 'Applicants in this booking, each with their own status + history.',
    type: [TrackingResponseDto],
  })
  applicants: TrackingResponseDto[];

  @ApiPropertyOptional({
    description: 'Destination country (ISO + name + flag).',
    type: 'object',
    nullable: true,
  })
  destination?: { isoCode: string; name: string; flagEmoji: string | null } | null;

  @ApiPropertyOptional({
    description: 'Visa type (purpose key + display label).',
    type: 'object',
    nullable: true,
  })
  visaType?: { purpose: string; label: string } | null;

  @ApiPropertyOptional({ description: 'Application-level current status (raw enum).' })
  currentStatus?: string;

  @ApiPropertyOptional({ description: 'Total fee amount as decimal string.' })
  totalAmount?: string | null;

  @ApiPropertyOptional({ description: 'Currency code, e.g. USD.' })
  currencyCode?: string | null;

  @ApiPropertyOptional({ description: 'Primary (portal) email on the booking.' })
  primaryEmail?: string | null;

  @ApiPropertyOptional({ description: 'When submission completed (post-DRAFT/UNPAID), null otherwise.' })
  submittedAt?: Date | null;

  @ApiPropertyOptional({ description: 'When payment cleared, null if not paid yet.' })
  paidAt?: Date | null;

  @ApiPropertyOptional({ description: 'Application creation timestamp.' })
  createdAt?: Date;
}
