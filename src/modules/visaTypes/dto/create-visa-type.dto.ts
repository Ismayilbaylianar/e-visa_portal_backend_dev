import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Entries feature — a VisaType is now just identity + display
 * (purpose, label, description, active, sortOrder). Validity, max stay
 * and the entry label moved to per-entry `visa_type_entries` rows; on
 * create the service seeds 3 default entries (Single/Double/Multiple)
 * which the admin edits afterward.
 *
 * `purpose` stays a lowercase snake_case machine key used for
 * joining/filtering across modules. Display strings live in `label` /
 * `description`.
 */
const PURPOSE_SNAKE_CASE = /^[a-z]+(?:_[a-z]+)*$/;

export class CreateVisaTypeDto {
  @ApiProperty({
    description:
      'Visa purpose key. Lowercase snake_case only (e.g. tourism, business, work_permit). Display text goes in `label`.',
    example: 'tourism',
  })
  @IsString()
  @MinLength(2, { message: 'Purpose must be at least 2 characters' })
  @MaxLength(100, { message: 'Purpose must not exceed 100 characters' })
  @Matches(PURPOSE_SNAKE_CASE, {
    message:
      'Purpose must be lowercase snake_case (letters and single underscores only, e.g. tourism, work_permit)',
  })
  purpose: string;

  @ApiProperty({
    description: 'Display label',
    example: 'Tourism',
  })
  @IsString()
  @MinLength(2, { message: 'Label must be at least 2 characters' })
  @MaxLength(100, { message: 'Label must not exceed 100 characters' })
  label: string;

  @ApiPropertyOptional({
    description: 'Visa type description',
    example: 'Tourism visa for leisure travel',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the visa type is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    default: 0,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
