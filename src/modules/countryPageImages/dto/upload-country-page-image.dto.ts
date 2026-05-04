import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Multipart body — the file rides on `file` field; this DTO covers
 * the JSON-style fields that come alongside it. Documented for
 * Swagger; not used for runtime validation since multipart bodies
 * arrive pre-parsed by Multer.
 */
export class UploadCountryPageImageBodyDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file (JPG/PNG/WebP, ≤5MB)' })
  file!: unknown;

  @ApiPropertyOptional({ description: 'Alt text for screen readers / SEO' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;
}

/**
 * Bulk reorder body. Accepts {id, displayOrder} pairs; service
 * validates that every id belongs to the path-param slug before
 * writing.
 */
export class CountryPageImageReorderItem {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  displayOrder: number;
}

export class ReorderCountryPageImagesDto {
  @ApiProperty({ type: [CountryPageImageReorderItem] })
  items: CountryPageImageReorderItem[];
}
