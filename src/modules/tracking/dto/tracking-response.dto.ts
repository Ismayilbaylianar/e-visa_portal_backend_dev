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
 * M11.10 (BUG 4) — Booking-level tracking response. Returned when
 * /track is queried by REF code (or by APP code when there are
 * sibling applicants on the same booking — frontend chooses how
 * to render). Single applicant returns a one-element list.
 */
export class BookingTrackingResponseDto {
  @ApiProperty({ description: 'Booking reference code', example: 'REF-2026-000001' })
  referenceCode: string;

  @ApiProperty({
    description: 'Applicants in this booking, each with their own status + history.',
    type: [TrackingResponseDto],
  })
  applicants: TrackingResponseDto[];
}
