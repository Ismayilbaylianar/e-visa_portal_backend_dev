import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CountrySection response. Country sections belong to a CountryPage, not
 * a Country. Stays in this DTO file because the legacy CountriesService
 * shape kept them adjacent to country responses.
 */
export class CountrySectionResponseDto {
  @ApiProperty({ description: 'Section ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Section title', example: 'Required Documents' })
  title: string;

  @ApiProperty({ description: 'Section content (HTML)', example: '<p>Passport, photo</p>' })
  content: string;

  @ApiProperty({ description: 'Sort order', example: 1 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether section is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

/**
 * Country reference row. After the Module 1.5 split, this DTO carries
 * only ISO 3166-1 reference fields. Slug, isPublished, SEO meta, and
 * sections moved to CountryPageResponseDto.
 */
export class CountryResponseDto {
  @ApiProperty({ description: 'Country ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 code', example: 'TR' })
  isoCode: string;

  @ApiProperty({ description: 'Country display name', example: 'Türkiye' })
  name: string;

  @ApiProperty({ description: 'Unicode flag emoji', example: '🇹🇷' })
  flagEmoji: string;

  @ApiProperty({ description: 'Continent code (AF/AS/EU/NA/SA/OC/AN)', example: 'AS' })
  continentCode: string;

  @ApiProperty({ description: 'UN M49 sub-region', example: 'Western Asia' })
  region: string;

  @ApiProperty({ description: 'Whether country is active', example: true })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Whether this country has a publishable CountryPage',
    example: true,
  })
  hasPage?: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class CountryListResponseDto {
  @ApiProperty({ type: [CountryResponseDto], description: 'List of countries' })
  items: CountryResponseDto[];

  @ApiProperty({ description: 'Total count', example: 250 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 5 })
  totalPages: number;
}

/**
 * Public-facing country response. After Module 1.5, public consumers
 * read country pages (with slug + SEO + sections) via the
 * CountryPagesController. This minimal DTO stays for backward-compat
 * shape on /public/countries (list of all reference countries) used by
 * the public selection dropdown.
 */
export class PublicCountryResponseDto {
  @ApiProperty({ description: 'Country ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 code', example: 'TR' })
  isoCode: string;

  @ApiProperty({ description: 'Country display name', example: 'Türkiye' })
  name: string;

  @ApiProperty({ description: 'Unicode flag emoji', example: '🇹🇷' })
  flagEmoji: string;

  @ApiProperty({ description: 'Continent code', example: 'AS' })
  continentCode: string;
}

export class PublicCountryListResponseDto {
  @ApiProperty({ type: [PublicCountryResponseDto], description: 'List of public countries' })
  items: PublicCountryResponseDto[];

  @ApiProperty({ description: 'Total count', example: 250 })
  total: number;
}
