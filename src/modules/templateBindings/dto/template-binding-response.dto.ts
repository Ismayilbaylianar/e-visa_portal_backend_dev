import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryBasicResponseDto {
  @ApiProperty({
    description: 'Country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Country name',
    example: 'United States',
  })
  name: string;

  @ApiProperty({
    description: 'Country ISO code',
    example: 'US',
  })
  isoCode: string;
}

export class VisaTypeBasicResponseDto {
  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Visa type label',
    example: 'Tourist Visa - 30 Days',
  })
  label: string;

  @ApiProperty({
    description: 'Visa type purpose',
    example: 'Tourism',
  })
  purpose: string;
}

export class TemplateBasicResponseDto {
  @ApiProperty({
    description: 'Template ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  id: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Standard Visa Application',
  })
  name: string;

  @ApiProperty({
    description: 'Template key',
    example: 'standard-visa-application',
  })
  key: string;
}

export class NationalityFeeResponseDto {
  @ApiProperty({
    description: 'Fee ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  id: string;

  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  nationalityCountryId: string;

  @ApiPropertyOptional({
    description: 'Nationality country details',
    type: CountryBasicResponseDto,
  })
  nationalityCountry?: CountryBasicResponseDto;

  @ApiProperty({
    description: 'Government fee amount',
    example: '50.00',
  })
  governmentFeeAmount: string;

  @ApiProperty({
    description: 'Service fee amount',
    example: '25.00',
  })
  serviceFeeAmount: string;

  @ApiPropertyOptional({
    description: 'Expedited fee amount (null if expedited not enabled)',
    example: '30.00',
  })
  expeditedFeeAmount?: string | null;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Whether expedited processing is enabled',
    example: true,
  })
  expeditedEnabled: boolean;

  @ApiProperty({
    description: 'Whether the fee is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

/**
 * Full template binding response with nested nationality fees
 */
export class TemplateBindingResponseDto {
  @ApiProperty({
    description: 'Template binding ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  visaTypeId: string;

  @ApiProperty({
    description: 'Template ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  templateId: string;

  @ApiProperty({
    description: 'Whether the binding is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Date from which the binding is valid (null means always valid from past)',
    example: '2026-04-01T00:00:00.000Z',
  })
  validFrom?: Date | null;

  @ApiPropertyOptional({
    description: 'Date until which the binding is valid (null means no end date)',
    example: '2026-12-31T23:59:59.999Z',
  })
  validTo?: Date | null;

  @ApiProperty({
    description:
      'M11.2 — binding-level express-processing default. Public preview reads this to ' +
      'decide whether the express checkbox renders.',
    example: false,
  })
  expeditedEnabled: boolean;

  @ApiPropertyOptional({
    description:
      'M11.2 — express fee shown alongside `expeditedEnabled`. String to preserve decimal ' +
      'precision; null when disabled or unset.',
    example: '50.00',
  })
  expeditedFeeAmount?: string | null;

  @ApiProperty({
    description:
      'M11.3 — minimum advance days for arrival date on this destination. Customer-side renderer applies this to the native date picker `min` attribute and to the `$bindingMinArrivalDays` cross-field validator token.',
    example: 3,
    default: 3,
  })
  minArrivalDaysAdvance: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Destination country details',
    type: CountryBasicResponseDto,
  })
  destinationCountry?: CountryBasicResponseDto;

  @ApiPropertyOptional({
    description: 'Visa type details',
    type: VisaTypeBasicResponseDto,
  })
  visaType?: VisaTypeBasicResponseDto;

  @ApiPropertyOptional({
    description: 'Template details',
    type: TemplateBasicResponseDto,
  })
  template?: TemplateBasicResponseDto;

  @ApiProperty({
    description: 'Nationality fees associated with this binding (ordered by country name)',
    type: [NationalityFeeResponseDto],
  })
  nationalityFees: NationalityFeeResponseDto[];
}

/**
 * Summary response for list endpoints (without nested nationality fees)
 */
export class TemplateBindingListItemResponseDto {
  @ApiProperty({ description: 'Template binding ID' })
  id: string;

  @ApiProperty({ description: 'Destination country ID' })
  destinationCountryId: string;

  @ApiProperty({ description: 'Visa type ID' })
  visaTypeId: string;

  @ApiProperty({ description: 'Template ID' })
  templateId: string;

  @ApiProperty({ description: 'Whether the binding is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Date from which the binding is valid' })
  validFrom?: Date | null;

  @ApiPropertyOptional({ description: 'Date until which the binding is valid' })
  validTo?: Date | null;

  @ApiProperty({ description: 'Number of nationality fees configured' })
  nationalityFeesCount: number;

  @ApiProperty({
    description: 'M11.2 — binding-level express-processing default.',
    example: false,
  })
  expeditedEnabled: boolean;

  @ApiPropertyOptional({
    description: 'M11.2 — express fee, decimal as string. Null when disabled.',
    example: '50.00',
  })
  expeditedFeeAmount?: string | null;

  @ApiProperty({
    description: 'M11.3 — minimum advance days for arrival date on this destination.',
    example: 3,
    default: 3,
  })
  minArrivalDaysAdvance: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: CountryBasicResponseDto })
  destinationCountry?: CountryBasicResponseDto;

  @ApiPropertyOptional({ type: VisaTypeBasicResponseDto })
  visaType?: VisaTypeBasicResponseDto;

  @ApiPropertyOptional({ type: TemplateBasicResponseDto })
  template?: TemplateBasicResponseDto;
}
