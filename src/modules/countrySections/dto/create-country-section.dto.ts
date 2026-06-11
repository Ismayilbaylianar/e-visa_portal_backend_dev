import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { CountrySectionSlot } from '@prisma/client';

export class CreateCountrySectionDto {
  @ApiProperty({
    description: 'Section title',
    example: 'Required Documents',
  })
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @ApiProperty({
    description:
      'Section content (HTML — TipTap output). May be empty; empty sections are hidden on the public page but stay editable in admin.',
    example: '<p>Passport, photo, application form</p>',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description:
      'Which card skin renders the section on the public page. EXTRA = plain prose. The slot does NOT decide position — sortOrder does.',
    enum: CountrySectionSlot,
    default: CountrySectionSlot.EXTRA,
  })
  @IsOptional()
  @IsEnum(CountrySectionSlot)
  slot?: CountrySectionSlot;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    default: 0,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the section is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
