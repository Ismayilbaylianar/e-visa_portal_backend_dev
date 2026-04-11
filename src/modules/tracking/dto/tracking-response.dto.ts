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

export class TrackingResponseDto {
  @ApiProperty({
    description: 'Application code',
    example: 'APP-2026-0001',
  })
  applicationCode: string;

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
