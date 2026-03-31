import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { VisaEntryType } from '@prisma/client';

export class CreateVisaTypeDto {
  @ApiProperty({
    description: 'Purpose of the visa',
    example: 'Tourism',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  purpose: string;

  @ApiProperty({
    description: 'Validity period in days',
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  validityDays: number;

  @ApiProperty({
    description: 'Maximum stay duration in days',
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  maxStay: number;

  @ApiProperty({
    description: 'Entry type for the visa',
    enum: VisaEntryType,
    example: VisaEntryType.SINGLE,
  })
  @IsEnum(VisaEntryType)
  entries: VisaEntryType;

  @ApiProperty({
    description: 'Display label for the visa type',
    example: 'Tourist Visa - 30 Days',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the visa type',
    example: 'Standard tourist visa for leisure travel',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the visa type is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for display purposes',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
