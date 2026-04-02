import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class CreateCountrySectionDto {
  @ApiProperty({
    description: 'Section title',
    example: 'Required Documents',
  })
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @ApiProperty({
    description: 'Section content (HTML allowed)',
    example: '<p>Passport, photo, application form</p>',
  })
  @IsString()
  @MinLength(1, { message: 'Content is required' })
  content: string;

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
