import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SelectionPreviewRequestDto {
  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  @IsNotEmpty()
  visaTypeId: string;

  @ApiProperty({
    description:
      'Visa type entry ID (Stage 3). The customer picks an entry in cascade Step 4; the matched fee row is the (nationality, entry) one. The client only calls preview AFTER an entry is chosen, so the price stays hidden until selection.',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  @IsNotEmpty()
  entryId: string;
}

/**
 * Fee preview structure matching the requirements
 */
export class FeePreviewDto {
  @ApiProperty({
    description: 'Government fee amount (decimal string)',
    example: '20.00',
  })
  governmentFeeAmount: string;

  @ApiProperty({
    description: 'Service fee amount (decimal string)',
    example: '10.00',
  })
  serviceFeeAmount: string;

  @ApiPropertyOptional({
    description: 'Expedited fee amount (null if not enabled)',
    example: '15.00',
  })
  expeditedFeeAmount: string | null;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Total amount (government + service, without expedited)',
    example: '30.00',
  })
  totalAmount: string;

  @ApiProperty({
    description: 'Whether expedited processing is enabled for this nationality',
    example: true,
  })
  expeditedEnabled: boolean;
}

/**
 * Selection preview success response
 */
export class SelectionPreviewSuccessDto {
  @ApiProperty({
    description: 'Whether the case is supported/eligible',
    example: true,
  })
  isEligible: boolean;

  @ApiProperty({
    description: 'Matching binding ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  bindingId: string;

  @ApiProperty({
    description: 'Template ID for the application form',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  templateId: string;

  @ApiProperty({
    description: 'Fee preview breakdown',
    type: FeePreviewDto,
  })
  fees: FeePreviewDto;
}

/**
 * Flip-binding-flow — per-binding context surfaced on the preview so
 * the dynamic-form renderer can hydrate cross-field validators
 * (`$bindingMinArrivalDays`) and the native arrival date input's `min`
 * attribute without an extra round-trip. After the flip, the customer
 * sees a SINGLE processing-days number that comes from their
 * nationality's fee row, not a range on the binding. Legacy
 * `minArrivalDaysAdvance` / `processingTimeMin` / `processingTimeMax`
 * fields are kept (all pointing at the same `processingDays`) so old
 * frontends + email templates still render until the public site cuts
 * over.
 */
export class PreviewBindingContextDto {
  @ApiProperty({
    description:
      'Processing days for this nationality on this destination (today + N earliest arrival).',
    example: 3,
    default: 3,
  })
  processingDays: number;

  @ApiPropertyOptional({
    description:
      'Express processing days (only set when the binding offers Express AND this nationality has an express override).',
    example: 1,
  })
  expeditedProcessingDays?: number | null;

  @ApiProperty({
    description: 'Legacy alias of `processingDays`. Use `processingDays`.',
    example: 3,
    deprecated: true,
  })
  minArrivalDaysAdvance: number;

  @ApiProperty({
    description: 'Legacy alias of `processingDays`. Use `processingDays`.',
    example: 3,
    deprecated: true,
  })
  processingTimeMin: number;

  @ApiProperty({
    description: 'Legacy alias of `processingDays`. Use `processingDays`.',
    example: 3,
    deprecated: true,
  })
  processingTimeMax: number;
}

/**
 * Selection preview response (can be success or not eligible)
 */
export class SelectionPreviewResponseDto {
  @ApiProperty({
    description: 'Whether the case is supported/eligible',
    example: true,
  })
  isEligible: boolean;

  @ApiPropertyOptional({
    description: 'Matching binding ID (only if eligible)',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  bindingId?: string;

  @ApiPropertyOptional({
    description: 'Template ID for the application form (only if eligible)',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Fee preview breakdown (only if eligible)',
    type: FeePreviewDto,
  })
  fees?: FeePreviewDto;

  @ApiPropertyOptional({
    description:
      'M11.3 — per-binding context for the customer-facing form renderer.',
    type: PreviewBindingContextDto,
  })
  binding?: PreviewBindingContextDto;
}
