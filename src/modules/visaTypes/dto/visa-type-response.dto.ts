import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisaEntryType } from '@prisma/client';

export class VisaTypeResponseDto {
  @ApiProperty({ description: 'Visa type ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Visa purpose', example: 'tourism' })
  purpose: string;

  @ApiProperty({ description: 'Validity in days', example: 30 })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days', example: 30 })
  maxStay: number;

  @ApiProperty({ description: 'Entry type', enum: VisaEntryType, example: 'SINGLE' })
  entries: VisaEntryType;

  @ApiProperty({ description: 'Display label', example: 'Tourism' })
  label: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Tourism visa' })
  description?: string;

  @ApiProperty({ description: 'Whether visa type is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Sort order', example: 1 })
  sortOrder: number;

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

  @ApiProperty({ description: 'Validity in days', example: 30 })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days', example: 30 })
  maxStay: number;

  @ApiProperty({ description: 'Entry type', enum: VisaEntryType, example: 'SINGLE' })
  entries: VisaEntryType;

  @ApiProperty({ description: 'Display label', example: 'Tourism' })
  label: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Tourism visa' })
  description?: string;
}

export class PublicVisaTypeListResponseDto {
  @ApiProperty({ type: [PublicVisaTypeResponseDto], description: 'List of public visa types' })
  items: PublicVisaTypeResponseDto[];

  @ApiProperty({ description: 'Total count', example: 5 })
  total: number;
}
