import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  ArrayNotEmpty,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUUID,
} from 'class-validator';

/**
 * Entries feature — create one entry on a visa type. `entryLabel` is
 * free text so admins can add CUSTOM entries beyond Single/Double/
 * Multiple. The service enforces maxStayDays <= validityDays (the DB
 * CHECK is the backstop).
 */
export class CreateVisaTypeEntryDto {
  @ApiProperty({ description: 'Entry label (free text)', example: 'Single' })
  @IsString()
  @MinLength(1, { message: 'Entry label is required' })
  @MaxLength(100, { message: 'Entry label must not exceed 100 characters' })
  entryLabel: string;

  @ApiPropertyOptional({ description: 'Optional machine key', example: 'single' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entryKey?: string;

  @ApiProperty({ description: 'Validity in days', example: 30 })
  @IsInt()
  @Min(1, { message: 'Validity days must be at least 1' })
  @Max(3650, { message: 'Validity days must not exceed 3650' })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days (<= validityDays)', example: 30 })
  @IsInt()
  @Min(1, { message: 'Max stay must be at least 1' })
  @Max(3650, { message: 'Max stay must not exceed 3650' })
  maxStayDays: number;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the entry is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVisaTypeEntryDto {
  @ApiPropertyOptional({ description: 'Entry label (free text)', example: 'Single entry' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entryLabel?: string;

  @ApiPropertyOptional({ description: 'Optional machine key' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entryKey?: string;

  @ApiPropertyOptional({ description: 'Validity in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number;

  @ApiPropertyOptional({ description: 'Maximum stay in days (<= validityDays)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  maxStayDays?: number;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the entry is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderVisaTypeEntriesDto {
  @ApiProperty({
    description:
      'Entry IDs in the desired final order. Must include every non-deleted entry on the visa type; partial reorders are rejected.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID' })
  orderedIds: string[];
}
