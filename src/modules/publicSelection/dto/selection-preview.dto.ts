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
}
