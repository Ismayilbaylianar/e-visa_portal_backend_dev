import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NationalityCountryBasicResponseDto {
  @ApiProperty({
    description: 'Country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Country name',
    example: 'Azerbaijan',
  })
  name: string;

  @ApiProperty({
    description: 'Country ISO code',
    example: 'AZ',
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

  @ApiPropertyOptional({
    description: 'Nationality country details',
    type: NationalityCountryBasicResponseDto,
  })
  nationalityCountry?: NationalityCountryBasicResponseDto;

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
    description: 'Expedited fee amount (null if expedited not enabled)',
    example: '15.00',
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
