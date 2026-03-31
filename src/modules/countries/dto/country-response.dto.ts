import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountrySectionDto {
  @ApiProperty({ description: 'Section ID' })
  id: string;

  @ApiProperty({ description: 'Section title' })
  title: string;

  @ApiProperty({ description: 'Section content (HTML)' })
  content: string;

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether section is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class CountryResponseDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;

  @ApiProperty({ description: 'Whether country is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'SEO meta title' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO meta description' })
  seoDescription?: string;

  @ApiProperty({ description: 'Whether country is published' })
  isPublished: boolean;

  @ApiPropertyOptional({
    type: [CountrySectionDto],
    description: 'Country sections',
  })
  sections?: CountrySectionDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PublicCountryResponseDto {
  @ApiProperty({ description: 'Country ID' })
  id: string;

  @ApiProperty({ description: 'Country name' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'ISO country code' })
  isoCode: string;

  @ApiPropertyOptional({ description: 'SEO meta title' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO meta description' })
  seoDescription?: string;

  @ApiPropertyOptional({
    type: [CountrySectionDto],
    description: 'Country sections',
  })
  sections?: CountrySectionDto[];
}
