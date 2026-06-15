import { ApiPropertyOptional } from '@nestjs/swagger';
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

const PURPOSE_SNAKE_CASE = /^[a-z]+(?:_[a-z]+)*$/;

/**
 * Entries feature — validity / max stay / entry are per-entry now, so
 * they're gone from the visa-type update payload. Manage them via the
 * visa-type entries endpoints (create/update/delete/reorder).
 */
export class UpdateVisaTypeDto {
  @ApiPropertyOptional({
    description:
      'Visa purpose key. Lowercase snake_case only (e.g. tourism, work_permit).',
    example: 'tourism',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Purpose must be at least 2 characters' })
  @MaxLength(100, { message: 'Purpose must not exceed 100 characters' })
  @Matches(PURPOSE_SNAKE_CASE, {
    message:
      'Purpose must be lowercase snake_case (letters and single underscores only, e.g. tourism, work_permit)',
  })
  purpose?: string;

  @ApiPropertyOptional({
    description: 'Display label',
    example: 'Tourism e-Visa',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Label must be at least 2 characters' })
  @MaxLength(100, { message: 'Label must not exceed 100 characters' })
  label?: string;

  @ApiPropertyOptional({
    description: 'Visa type description',
    example: 'Updated tourism visa description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the visa type is active',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
