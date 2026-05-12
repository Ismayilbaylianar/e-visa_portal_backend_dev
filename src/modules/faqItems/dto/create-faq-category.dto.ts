import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * M11.14 (BUG SS) — Admin payload for creating a new FAQ category.
 *
 * `key` is the immutable slug used by FaqItem.category as a string
 * reference. We hold admins to a strict slug shape (lowercase letters,
 * digits, dashes) so URLs / DB filters stay predictable; the service
 * additionally checks uniqueness at insert time so a race with a
 * concurrent create surfaces as a clean 409 instead of a P2002.
 */
export class CreateFaqCategoryDto {
  @ApiProperty({
    description:
      'Stable slug — lowercase letters, digits, dashes. Used by FaqItem.category as a string foreign key.',
    example: 'refund-policy',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'key must be lowercase letters / digits with single dashes (e.g. "refund-policy")',
  })
  key!: string;

  @ApiProperty({
    description: 'Human-friendly label shown in the dropdown and on /faq.',
    minLength: 1,
    maxLength: 100,
    example: 'Refund Policy',
  })
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Sort key on /faq (smaller is higher). Defaults to "last".',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Hide newly-created categories from /faq without deleting.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
