import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateCountrySectionDto {
  @ApiPropertyOptional({
    description: 'Section title',
    example: 'Required Documents',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiPropertyOptional({
    description:
      'Section content (HTML — TipTap output). May be empty; empty sections are hidden on the public page but stay editable in admin.',
    example: '<p>Updated content</p>',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Which card skin renders the section on the public page.',
    enum: CountrySectionSlot,
  })
  @IsOptional()
  @IsEnum(CountrySectionSlot)
  slot?: CountrySectionSlot;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the section is active',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
