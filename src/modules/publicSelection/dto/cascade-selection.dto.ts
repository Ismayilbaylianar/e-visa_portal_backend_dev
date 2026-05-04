import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

/**
 * Module 10 — cascade selection DTOs.
 *
 * The original `getOptions` endpoint returns the FULL lists of every
 * country + visa type. That worked when the catalog was small but
 * leads to two real bugs once the catalog grows:
 *   • "Visa not available" — user picks a (nationality, destination,
 *     visaType) combo that has no active binding, then sees an error.
 *     Cascade endpoints filter pre-pick so the dropdown only shows
 *     valid choices.
 *   • Same-country (AZ → AZ) — user picks themselves as a
 *     destination. The destination cascade excludes the user's own
 *     nationality at the data layer.
 */

export class GetDestinationsByNationalityQueryDto {
  @ApiProperty({
    description: 'Nationality country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  nationality!: string;
}

export class GetVisaTypesByCombinationQueryDto {
  @ApiProperty({ description: 'Nationality country UUID' })
  @IsUUID()
  @IsNotEmpty()
  nationality!: string;

  @ApiProperty({ description: 'Destination country UUID' })
  @IsUUID()
  @IsNotEmpty()
  destination!: string;
}

export class CascadeCountryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 code', example: 'AZ' })
  isoCode!: string;

  @ApiPropertyOptional({ description: 'Flag emoji', example: '🇦🇿' })
  flagEmoji?: string;

  @ApiPropertyOptional({
    description: 'CountryPage slug (only set for countries with a published marketing page)',
    example: 'azerbaijan',
  })
  slug?: string;
}

export class CascadeDestinationsResponseDto {
  @ApiProperty({ type: [CascadeCountryDto] })
  destinations!: CascadeCountryDto[];
}

export class CascadeVisaTypeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  purpose!: string;

  @ApiProperty()
  validityDays!: number;

  @ApiProperty()
  maxStay!: number;

  @ApiProperty({ description: 'SINGLE / DOUBLE / MULTIPLE' })
  entries!: string;
}

export class CascadeVisaTypesResponseDto {
  @ApiProperty({ type: [CascadeVisaTypeDto] })
  visaTypes!: CascadeVisaTypeDto[];
}

/**
 * Module 10 — IP-based nationality detection result. The geoLookup
 * service is currently a stub (returns null); when it's wired to a
 * real provider this endpoint will start returning real ISO codes.
 * The frontend handles the null case by falling through to the
 * manual dropdown — no breakage during the placeholder period.
 */
export class DetectNationalityResponseDto {
  @ApiPropertyOptional({
    description:
      'ISO 3166-1 alpha-2 country code resolved from the request IP. Null when geoLookup cannot resolve OR the country is not in our active nationalities list.',
    example: 'AZ',
  })
  countryCode!: string | null;

  @ApiPropertyOptional({
    description:
      'Country reference matched against our active nationalities. Only present when `countryCode` resolved AND the country exists in the DB. Lets the frontend pre-select the dropdown without a second lookup. `slug` is set when the matched country also has a published CountryPage; otherwise undefined.',
  })
  country?: {
    id: string;
    name: string;
    isoCode: string;
    flagEmoji?: string;
    slug?: string;
  };

  @ApiPropertyOptional({
    description:
      'Human-readable fallback message when detection failed. Frontend can show as a hint above the manual dropdown.',
    example: 'Please select your nationality',
  })
  fallback?: string;
}
