import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContentPageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'URL slug, e.g. "about" → /about' })
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'HTML body — admin-edited; rendered as-is on public pages' })
  contentHtml: string;

  @ApiPropertyOptional({ description: 'Override <title> on the public page' })
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Override <meta name="description">' })
  metaDescription?: string;

  @ApiProperty({ description: 'Public surfaces 404 when false' })
  isPublished: boolean;

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last admin who edited this page' })
  updatedByUserId?: string;
}

export class ContentPageListResponseDto {
  @ApiProperty({ type: [ContentPageResponseDto] })
  items: ContentPageResponseDto[];

  @ApiProperty()
  total: number;
}
