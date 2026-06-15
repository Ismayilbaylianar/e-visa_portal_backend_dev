import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Entries feature — one selectable entry on a visa type. Validity +
 * max stay are per-entry now; `entryLabel` is free text (custom
 * entries allowed).
 */
export class VisaTypeEntryResponseDto {
  @ApiProperty({ description: 'Entry ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Entry label (free text)', example: 'Single' })
  entryLabel: string;

  @ApiPropertyOptional({ description: 'Optional machine key', example: 'single' })
  entryKey?: string | null;

  @ApiProperty({ description: 'Validity in days', example: 30 })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days', example: 30 })
  maxStayDays: number;

  @ApiProperty({ description: 'Sort order', example: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the entry is active', example: true })
  isActive: boolean;
}

export class VisaTypeResponseDto {
  @ApiProperty({ description: 'Visa type ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Visa purpose', example: 'tourism' })
  purpose: string;

  @ApiProperty({ description: 'Display label', example: 'Tourism' })
  label: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Tourism visa' })
  description?: string;

  @ApiProperty({ description: 'Whether visa type is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Sort order', example: 1 })
  sortOrder: number;

  @ApiProperty({
    type: [VisaTypeEntryResponseDto],
    description: 'Per-entry options (validity/max stay), ordered by sortOrder.',
  })
  entries: VisaTypeEntryResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class VisaTypeListResponseDto {
  @ApiProperty({ type: [VisaTypeResponseDto], description: 'List of visa types' })
  items: VisaTypeResponseDto[];

  @ApiProperty({ description: 'Total count', example: 5 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}

export class PublicVisaTypeResponseDto {
  @ApiProperty({ description: 'Visa type ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Visa purpose', example: 'tourism' })
  purpose: string;

  @ApiProperty({ description: 'Display label', example: 'Tourism' })
  label: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Tourism visa' })
  description?: string;

  @ApiProperty({
    type: [VisaTypeEntryResponseDto],
    description: 'Active entry options for public display.',
  })
  entries: VisaTypeEntryResponseDto[];
}

export class PublicVisaTypeListResponseDto {
  @ApiProperty({ type: [PublicVisaTypeResponseDto], description: 'List of public visa types' })
  items: PublicVisaTypeResponseDto[];

  @ApiProperty({ description: 'Total count', example: 5 })
  total: number;
}
