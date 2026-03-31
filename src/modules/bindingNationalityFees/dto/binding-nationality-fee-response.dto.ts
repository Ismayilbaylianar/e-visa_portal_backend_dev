import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class NationalityCountryBasicResponseDto {
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

export class BindingNationalityFeeResponseDto {
  @ApiProperty({
    description: 'Fee ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Template binding ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  templateBindingId: string;

  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
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

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Nationality country details',
    type: NationalityCountryBasicResponseDto,
  })
  nationalityCountry?: NationalityCountryBasicResponseDto;
}
