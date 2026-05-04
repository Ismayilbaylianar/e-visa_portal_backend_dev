import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContentPageDto {
  /**
   * URL-safe slug (lowercase, dash-separated). Becomes the public route
   * fragment (`/about` → slug='about'). Validated to a conservative
   * subset to keep URLs predictable.
   */
  @ApiProperty({ example: 'about', description: 'URL slug — lowercase, dashes only' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/digits with dashes (no spaces or underscores)',
  })
  slug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'HTML body. Trusted (admin-only writes).' })
  @IsString()
  @IsNotEmpty()
  contentHtml: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
