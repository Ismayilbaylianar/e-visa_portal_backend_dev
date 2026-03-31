import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({
    description: 'Country name',
    example: 'United States',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'united-states',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'US',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(3)
  @Matches(/^[A-Z]{2,3}$/, {
    message: 'ISO code must be 2-3 uppercase letters',
  })
  isoCode: string;

  @ApiPropertyOptional({
    description: 'Whether the country is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'SEO meta title',
    example: 'Apply for United States e-Visa Online',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description',
    example: 'Get your United States e-Visa quickly and easily. Apply online now.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @ApiPropertyOptional({
    description: 'Whether the country is published and visible to public',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
