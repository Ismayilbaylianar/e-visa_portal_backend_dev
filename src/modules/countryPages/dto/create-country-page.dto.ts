import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCountryPageDto {
  @ApiProperty({
    description: 'UUID of the Country reference row this page belongs to',
    example: 'b4e7c1a3-...',
  })
  @IsUUID()
  countryId: string;

  @ApiProperty({
    description: 'URL-friendly slug (lowercase alphanumeric with hyphens)',
    example: 'turkey',
  })
  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters' })
  @MaxLength(100, { message: 'Slug must not exceed 100 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @ApiPropertyOptional({ description: 'Whether the page is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the page is visible to public', default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'SEO title', example: 'Türkiye Visa' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO description', example: 'Visa to Türkiye' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;
}
