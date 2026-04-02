import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class UpdateCountrySectionDto {
  @ApiPropertyOptional({
    description: 'Section title',
    example: 'Required Documents',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Section content (HTML allowed)',
    example: '<p>Updated content</p>',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Content cannot be empty' })
  content?: string;

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
