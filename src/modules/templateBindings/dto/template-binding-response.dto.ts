import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CountryBasicResponseDto {
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

class VisaTypeBasicResponseDto {
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

class TemplateBasicResponseDto {
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

class NationalityFeeBasicResponseDto {
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
    description: 'Expedited fee amount',
    example: '30.00',
  })
  expeditedFeeAmount?: string;

  @ApiProperty({
    description: 'Currency code',
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
}

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
    description: 'Date from which the binding is valid',
    example: '2024-01-01T00:00:00.000Z',
  })
  validFrom?: Date;

  @ApiPropertyOptional({
    description: 'Date until which the binding is valid',
    example: '2024-12-31T23:59:59.999Z',
  })
  validTo?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
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

  @ApiPropertyOptional({
    description: 'Nationality fees associated with this binding',
    type: [NationalityFeeBasicResponseDto],
  })
  nationalityFees?: NationalityFeeBasicResponseDto[];
}
