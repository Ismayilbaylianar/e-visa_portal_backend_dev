import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateCountryDto {
  @ApiPropertyOptional({
    description: 'Country name',
    example: 'Turkey',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (lowercase, alphanumeric with hyphens)',
    example: 'turkey',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters' })
  @MaxLength(100, { message: 'Slug must not exceed 100 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'TR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'ISO code must be exactly 2 uppercase letters',
  })
  isoCode?: string;

  @ApiPropertyOptional({
    description: 'Whether the country is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the country is published (visible to public)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'SEO title for the country page',
    example: 'Turkey e-Visa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'SEO title must not exceed 200 characters' })
  seoTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO description for the country page',
    example: 'Apply for Turkey e-Visa online',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'SEO description must not exceed 500 characters' })
  seoDescription?: string;
}
