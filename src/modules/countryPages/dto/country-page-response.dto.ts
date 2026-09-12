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
 * Entries feature (Stage 3) — one entry nested under a visa type on the
 * public country page. The "Available Visas" card lists these beneath
 * their visa type (label + per-entry validity / max stay). Free-text
 * `entryLabel`.
 */
export class PublicCountryPageEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Free-text entry label' })
  entryLabel: string;

  @ApiProperty()
  validityDays: number;

  @ApiProperty()
  maxStayDays: number;

  @ApiProperty()
  sortOrder: number;
}

/**
 * M11.1 — public-facing visa-type summary embedded in the country
 * page response. Lets the country page render a visa-type card grid
 * in one round trip. Pricing here is intentionally GENERIC (the
 * lowest-cost active fee for any nationality) — nationality-specific
 * pricing still flows through the cascade preview endpoint.
 *
 * Entries feature (Stage 3) — validity / max stay / entry label moved
 * to per-entry `entries[]`. Replaces the Stage 1+2 representative-entry
 * shim (single validityDays/maxStay/entries scalars).
 */
export class PublicCountryPageVisaTypeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  purpose: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ type: [PublicCountryPageEntryDto] })
  entries: PublicCountryPageEntryDto[];

  @ApiPropertyOptional({ description: 'Lowest active total fee across nationalities (display only)' })
  fromAmount?: string;

  @ApiPropertyOptional()
  currencyCode?: string;
}

/** M11.1 — hero image embed on the public country page. */
export class PublicCountryPageImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Resolved public URL' })
  imageUrl: string;

  @ApiPropertyOptional()
  altText?: string;

  @ApiProperty()
  displayOrder: number;
}

/**
 * Public response shape (no admin-only fields like isActive). Includes the
 * embedded country and active sections for public detail rendering.
 */
/**
 * One nationality that can buy this destination.
 *
 * Derived from the fee table at request time, never authored. See
 * `destination-sellability.ts` for the rule that decides membership.
 */
export class PublicEligibleNationalityDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'DE' })
  isoCode: string;

  @ApiProperty({ example: 'Germany' })
  name: string;

  @ApiPropertyOptional({ example: '🇩🇪' })
  flagEmoji?: string;
}

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

  /** M11.1 — published hero images, ordered by displayOrder. */
  @ApiPropertyOptional({ type: [PublicCountryPageImageDto] })
  images?: PublicCountryPageImageDto[];

  /** M11.1 — visa types with active bindings for this destination. */
  @ApiPropertyOptional({ type: [PublicCountryPageVisaTypeDto] })
  visaTypes?: PublicCountryPageVisaTypeDto[];

  /**
   * Every nationality with an active fee for this destination, sorted
   * by name. Computed from the fee table on every request, so it can
   * never drift from what is actually purchasable — this replaced a
   * hand-authored CMS section that did.
   *
   * Detail endpoint only; the list endpoint omits it. An empty array
   * means nothing is priced yet and the section is not rendered.
   */
  @ApiPropertyOptional({ type: [PublicEligibleNationalityDto] })
  eligibleNationalities?: PublicEligibleNationalityDto[];
}

export class PublicCountryPageListResponseDto {
  @ApiProperty({ type: [PublicCountryPageResponseDto] })
  items: PublicCountryPageResponseDto[];

  @ApiProperty()
  total: number;
}
