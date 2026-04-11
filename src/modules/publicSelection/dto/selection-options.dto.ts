import { ApiProperty } from '@nestjs/swagger';

export class CountryOptionDto {
  @ApiProperty({
    description: 'Country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Country name',
    example: 'Turkey',
  })
  name: string;

  @ApiProperty({
    description: 'Country slug',
    example: 'turkey',
  })
  slug: string;

  @ApiProperty({
    description: 'ISO country code',
    example: 'TR',
  })
  isoCode: string;
}

export class VisaTypeOptionDto {
  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Visa purpose',
    example: 'tourism',
  })
  purpose: string;

  @ApiProperty({
    description: 'Validity in days',
    example: 30,
  })
  validityDays: number;

  @ApiProperty({
    description: 'Maximum stay in days',
    example: 30,
  })
  maxStay: number;

  @ApiProperty({
    description: 'Entry type (SINGLE, DOUBLE, MULTIPLE)',
    example: 'SINGLE',
  })
  entries: string;

  @ApiProperty({
    description: 'Display label',
    example: 'Tourist Visa - 30 Days Single Entry',
  })
  label: string;
}

/**
 * Selection options response
 * Note: Nationality countries use the same countries table as destination countries.
 * This is an assumption - in production, you may want a separate nationality source.
 */
export class SelectionOptionsResponseDto {
  @ApiProperty({
    type: [CountryOptionDto],
    description: 'Available destination countries (active and published)',
  })
  destinationCountries: CountryOptionDto[];

  @ApiProperty({
    type: [CountryOptionDto],
    description: 'Available nationality countries (currently uses active countries as source)',
  })
  nationalityCountries: CountryOptionDto[];

  @ApiProperty({
    type: [VisaTypeOptionDto],
    description: 'Available visa types',
  })
  visaTypes: VisaTypeOptionDto[];
}
