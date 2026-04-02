import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CountryResponseDto {
  @ApiProperty({ description: 'Country ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Country name', example: 'Turkey' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'turkey' })
  slug: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 code', example: 'TR' })
  isoCode: string;

  @ApiProperty({ description: 'Whether country is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Whether country is published', example: true })
  isPublished: boolean;

  @ApiPropertyOptional({ description: 'SEO title', example: 'Turkey Visa' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO description', example: 'Turkey visa info' })
  seoDescription?: string;

  @ApiPropertyOptional({
    description: 'Country sections',
    type: [CountrySectionResponseDto],
  })
  sections?: CountrySectionResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class CountryListResponseDto {
  @ApiProperty({ type: [CountryResponseDto], description: 'List of countries' })
  items: CountryResponseDto[];

  @ApiProperty({ description: 'Total count', example: 10 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}

export class PublicCountryResponseDto {
  @ApiProperty({ description: 'Country ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Country name', example: 'Turkey' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'turkey' })
  slug: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 code', example: 'TR' })
  isoCode: string;

  @ApiPropertyOptional({ description: 'SEO title', example: 'Turkey Visa' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO description', example: 'Turkey visa info' })
  seoDescription?: string;

  @ApiPropertyOptional({
    description: 'Active country sections',
    type: [CountrySectionResponseDto],
  })
  sections?: CountrySectionResponseDto[];
}

export class PublicCountryListResponseDto {
  @ApiProperty({ type: [PublicCountryResponseDto], description: 'List of public countries' })
  items: PublicCountryResponseDto[];

  @ApiProperty({ description: 'Total count', example: 10 })
  total: number;
}
