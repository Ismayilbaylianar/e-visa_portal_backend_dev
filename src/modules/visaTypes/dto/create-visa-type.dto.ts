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
} from 'class-validator';
import { VisaEntryType } from '@prisma/client';

export class CreateVisaTypeDto {
  @ApiProperty({
    description: 'Visa purpose (e.g., tourism, business)',
    example: 'tourism',
  })
  @IsString()
  @MinLength(2, { message: 'Purpose must be at least 2 characters' })
  @MaxLength(100, { message: 'Purpose must not exceed 100 characters' })
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
    description: 'Maximum stay in days',
    example: 30,
  })
  @IsInt()
  @Min(1, { message: 'Max stay must be at least 1' })
  @Max(365, { message: 'Max stay must not exceed 365' })
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
