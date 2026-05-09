import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * M11.7 (C1) — Admin payload for renaming / reordering / hiding a
 * single FAQ category. `key` is immutable on this endpoint (categories
 * are referenced by key from FaqItem.category, so renaming the key
 * would orphan items).
 */
export class UpdateFaqCategoryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
