import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/**
 * `purpose` is a machine key used for joining/filtering across modules
 * (TemplateBindings group by purpose, public selection groups duplicate
 * purpose+entries pairs visually). Restricting to lowercase snake_case
 * keeps the key URL-safe and prevents accidental "Tourism" vs "tourism"
 * fragmentation. Display strings live in `label` / `description`.
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
    description: 'Visa validity in days',
    example: 30,
  })
  @IsInt()
  @Min(1, { message: 'Validity days must be at least 1' })
  @Max(3650, { message: 'Validity days must not exceed 3650' })
  validityDays: number;

  @ApiProperty({
    description: 'Maximum stay in days. Must be <= validityDays.',
    example: 30,
  })
  @IsInt()
  @Min(1, { message: 'Max stay must be at least 1' })
  @Max(365, { message: 'Max stay must not exceed 365' })
  @MaxStayLessThanOrEqualValidityDays()
  maxStay: number;

  @ApiProperty({
    description: 'Entry type',
    enum: VisaEntryType,
    example: 'SINGLE',
  })
  @IsEnum(VisaEntryType, { message: 'Invalid entry type' })
  entries: VisaEntryType;

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
