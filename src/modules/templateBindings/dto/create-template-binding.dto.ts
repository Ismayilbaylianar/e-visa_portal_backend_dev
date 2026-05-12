import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTemplateBindingDto {
  @ApiProperty({
    description: 'Destination country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  visaTypeId: string;

  @ApiProperty({
    description: 'Template UUID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional({
    description: 'Whether the binding is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Date from which the binding is valid',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Date until which the binding is valid',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  /** M11.2 — per-binding expedited toggle. Canonical source for
   *  `feePreview.fees.expeditedEnabled`. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  expeditedEnabled?: boolean;

  /** M11.2 — per-binding expedited fee. Required when
   *  `expeditedEnabled=true`; ignored otherwise. */
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expeditedFeeAmount?: number;

  /**
   * M11.3 — minimum number of days between today and the earliest
   * arrival date a customer is allowed to pick. Per-destination
   * business rule (Türkiye 3, USA 14, Egypt 1, etc.). Default 3.
   */
  @ApiPropertyOptional({
    description:
      'Minimum advance days required for arrival date (today + N). Default 3.',
    example: 3,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minArrivalDaysAdvance?: number;

  /**
   * M11.14 (BUG OO) — processing window shown to customers as
   * "{min}-{max} business days". Min must be >= 1 and <= max; max
   * <= 365. Cross-field check enforced in the service layer
   * (validateProcessingWindow) so create + update share one rule.
   */
  @ApiPropertyOptional({
    description: 'Lower bound of the processing window, in business days. Default 7.',
    example: 7,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  processingTimeMin?: number;

  @ApiPropertyOptional({
    description: 'Upper bound of the processing window, in business days. Default 14.',
    example: 14,
    default: 14,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  processingTimeMax?: number;
}
