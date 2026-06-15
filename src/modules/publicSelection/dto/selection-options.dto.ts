import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryOptionDto {
  @ApiProperty({
    description: 'Country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Country name',
    example: 'Türkiye',
  })
  name: string;

  @ApiPropertyOptional({
    description:
      'CountryPage slug (only present when the country has an active published page; nationality entries do not).',
    example: 'turkey',
  })
  slug?: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 code',
    example: 'TR',
  })
  isoCode: string;

  @ApiPropertyOptional({
    description: 'Unicode flag emoji (when available from reference data)',
    example: '🇹🇷',
  })
  flagEmoji?: string;
}

/**
 * Entries feature (Stage 3) — one entry on a visa type in the legacy
 * bulk options response. Mirrors CascadeVisaTypeEntryDto.
 */
export class VisaTypeEntryOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Free-text entry label' })
  entryLabel: string;

  @ApiProperty({ description: 'Validity in days for this entry' })
  validityDays: number;

  @ApiProperty({ description: 'Maximum stay in days for this entry' })
  maxStayDays: number;

  @ApiProperty()
  sortOrder: number;
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

  /**
   * Entries feature (Stage 3) — full list of active entries. Replaces
   * the Stage 1+2 representative-entry shim (single validityDays/
   * maxStay/entries scalars).
   */
  @ApiProperty({ type: [VisaTypeEntryOptionDto] })
  entries: VisaTypeEntryOptionDto[];

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
