import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountryPageImageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  countryPageId: string;

  @ApiProperty({ description: 'Storage key (resolve via signed URL on read)' })
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Alt text for screen readers / SEO' })
  altText?: string;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CountryPageImageListResponseDto {
  @ApiProperty({ type: [CountryPageImageResponseDto] })
  items: CountryPageImageResponseDto[];

  @ApiProperty()
  total: number;
}
