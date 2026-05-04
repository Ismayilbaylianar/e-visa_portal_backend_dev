import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Multipart create body — `file` is the optional image file (the
 * frontend renders a flag-emoji fallback when missing). Everything
 * else is JSON-style. Class-validator runs against the body fields
 * after Multer parses the file off.
 */
export class CreateHomepageSlideBodyDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  file?: unknown;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @ApiPropertyOptional({ default: 'Apply Now' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaText?: string;

  @ApiPropertyOptional({ description: 'Override the CTA URL — when omitted falls back to /country/{slug}' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  ctaUrl?: string;

  @ApiPropertyOptional({ description: 'Link to a country (auto-derives the CTA target slug)' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  // class-transformer leaves `isPublished` as a string when sent via
  // multipart form fields ("true"/"false"); accept both.
  isPublished?: boolean | string;
}
