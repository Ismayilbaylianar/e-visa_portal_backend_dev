import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CountrySectionResponseDto } from '../../countries/dto';

/**
 * Light embedded country reference inside a CountryPage response. Avoids a
 * second round-trip when the admin UI needs to render a page row.
 */
export class CountryPageCountryRefDto {
  @ApiProperty({ example: 'b4e7c1a3-...' })
  id: string;

  @ApiProperty({ example: 'TR' })
  isoCode: string;

  @ApiProperty({ example: 'Türkiye' })
  name: string;

  @ApiProperty({ example: '🇹🇷' })
  flagEmoji: string;
}

export class CountryPageResponseDto {
  @ApiProperty({ description: 'CountryPage UUID' })
  id: string;

  @ApiProperty({ description: 'Underlying Country UUID' })
  countryId: string;

  @ApiProperty({ description: 'URL slug', example: 'turkey' })
  slug: string;

  @ApiProperty({ description: 'Active flag', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Published flag', example: true })
  isPublished: boolean;

  @ApiPropertyOptional({ description: 'SEO title' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO description' })
  seoDescription?: string;

  @ApiPropertyOptional({ description: 'Embedded country reference (id + isoCode + name + flag)' })
  country?: CountryPageCountryRefDto;

  @ApiPropertyOptional({
    description: 'Sections (Overview / Requirements / FAQ / etc.)',
    type: [CountrySectionResponseDto],
  })
  sections?: CountrySectionResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class CountryPageListResponseDto {
  @ApiProperty({ type: [CountryPageResponseDto] })
  items: CountryPageResponseDto[];

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

/**
 * Public response shape (no admin-only fields like isActive). Includes the
 * embedded country and active sections for public detail rendering.
 */
export class PublicCountryPageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  seoTitle?: string;

  @ApiPropertyOptional()
  seoDescription?: string;

  @ApiProperty({ type: () => CountryPageCountryRefDto })
  country: CountryPageCountryRefDto;

  @ApiPropertyOptional({ type: [CountrySectionResponseDto] })
  sections?: CountrySectionResponseDto[];
}

export class PublicCountryPageListResponseDto {
  @ApiProperty({ type: [PublicCountryPageResponseDto] })
  items: PublicCountryPageResponseDto[];

  @ApiProperty()
  total: number;
}
