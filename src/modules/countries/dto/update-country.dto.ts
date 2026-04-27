import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * Admin override for a Country reference row. The bulk of country data is
 * managed via the UN ISO 3166-1 seed (prisma/data/countries-iso3166.json);
 * this DTO covers the small subset an admin may want to tweak (typo fix on
 * a country name, swap flag emoji rendering, deactivate a region, etc.).
 *
 * Publishable fields (slug, SEO meta, isPublished) live on the
 * `country_pages` table and are managed by the CountryPagesService — not
 * here. CountriesService no longer accepts create/delete on countries.
 */
export class UpdateCountryDto {
  @ApiPropertyOptional({
    description: 'Country display name (English by default; ISO standard)',
    example: 'Türkiye',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(200, { message: 'Name must not exceed 200 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Unicode flag emoji',
    example: '🇹🇷',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Flag emoji is too long' })
  flagEmoji?: string;

  @ApiPropertyOptional({
    description: 'Continent code (AF / AS / EU / NA / SA / OC / AN)',
    example: 'AS',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(AF|AS|EU|NA|SA|OC|AN)$/, {
    message: 'continentCode must be one of AF, AS, EU, NA, SA, OC, AN',
  })
  continentCode?: string;

  @ApiPropertyOptional({
    description: 'UN M49 sub-region (e.g. Western Asia, Western Europe)',
    example: 'Western Asia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({
    description: 'Whether the country is active for FK references',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
