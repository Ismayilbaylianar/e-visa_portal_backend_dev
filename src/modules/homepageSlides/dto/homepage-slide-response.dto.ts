import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HomepageSlideCountryRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  isoCode: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  flagEmoji: string;

  @ApiPropertyOptional({ description: 'CountryPage slug, if a published page exists' })
  slug?: string;
}

export class HomepageSlideResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ description: 'Public URL for the uploaded image (null when admin hasn\'t uploaded yet)' })
  imageUrl?: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  subtitle?: string;

  @ApiProperty()
  ctaText: string;

  @ApiProperty({
    description:
      'Resolved CTA URL — explicit `ctaUrl` if set, otherwise `/country/{slug}` derived from the linked country, otherwise `/`.',
  })
  ctaUrl: string;

  @ApiPropertyOptional({ type: HomepageSlideCountryRefDto })
  country?: HomepageSlideCountryRefDto;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class HomepageSlideListResponseDto {
  @ApiProperty({ type: [HomepageSlideResponseDto] })
  items: HomepageSlideResponseDto[];

  @ApiProperty()
  total: number;
}
