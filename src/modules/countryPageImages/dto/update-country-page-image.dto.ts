import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * After upload, the only mutable bits are alt text and visibility.
 * The actual file (`imageUrl` / storage key) is immutable — to swap
 * an image, delete the row and upload a new one.
 */
export class UpdateCountryPageImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
