import { ApiProperty } from '@nestjs/swagger';

export class CountryOptionDto {
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
    description: 'Country slug',
    example: 'united-states',
  })
  slug: string;

  @ApiProperty({
    description: 'ISO country code',
    example: 'US',
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
    description: 'Entry type',
    example: 'single',
  })
  entries: string;

  @ApiProperty({
    description: 'Display label',
    example: 'Tourist Visa - 30 Days Single Entry',
  })
  label: string;
}

export class SelectionOptionsResponseDto {
  @ApiProperty({
    type: [CountryOptionDto],
    description: 'Available destination countries',
  })
  countries: CountryOptionDto[];

  @ApiProperty({
    type: [VisaTypeOptionDto],
    description: 'Available visa types',
  })
  visaTypes: VisaTypeOptionDto[];
}
