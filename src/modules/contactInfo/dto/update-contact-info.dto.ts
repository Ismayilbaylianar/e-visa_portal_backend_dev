import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Partial update — every field optional. Email is the only field
 *  that's not nullable on the model, but if the admin omits it from
 *  the patch, we keep the existing value. */
export class UpdateContactInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportHours?: string;

  /** Free-form social-links object. Validated as object only — the
   *  shape is conventional (facebook/twitter/instagram/linkedin) but
   *  not enforced so future channels can be added without a schema
   *  change. */
  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  // M11.10 (BUG 7) — Secondary contact channels. Pass empty string
  // to clear; omit to leave untouched. Email2 uses @IsString rather
  // than @IsEmail so admin can clear with '' (class-validator's
  // @IsEmail rejects empty string even with @IsOptional).
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(254) email2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) whatsapp2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) telegram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) customNote?: string;
}
