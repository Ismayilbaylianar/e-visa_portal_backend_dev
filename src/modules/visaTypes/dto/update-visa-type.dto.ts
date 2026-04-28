import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsEnum,
  Matches,
} from 'class-validator';
import { VisaEntryType } from '@prisma/client';
import { MaxStayLessThanOrEqualValidityDays } from '../validators/max-stay-le-validity-days.validator';

const PURPOSE_SNAKE_CASE = /^[a-z]+(?:_[a-z]+)*$/;

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
    description: 'Visa validity in days',
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Validity days must be at least 1' })
  @Max(3650, { message: 'Validity days must not exceed 3650' })
  validityDays?: number;

  @ApiPropertyOptional({
    description:
      'Maximum stay in days. Must be <= validityDays. Cross-field check skips when only one of the pair is sent; service re-validates against the persisted row.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Max stay must be at least 1' })
  @Max(365, { message: 'Max stay must not exceed 365' })
  @MaxStayLessThanOrEqualValidityDays()
  maxStay?: number;

  @ApiPropertyOptional({
    description: 'Entry type',
    enum: VisaEntryType,
    example: 'MULTIPLE',
  })
  @IsOptional()
  @IsEnum(VisaEntryType, { message: 'Invalid entry type' })
  entries?: VisaEntryType;

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
