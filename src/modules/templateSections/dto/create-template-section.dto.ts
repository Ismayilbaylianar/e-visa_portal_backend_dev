import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateTemplateSectionDto {
  @ApiProperty({
    description: 'Section title',
    example: 'Personal Information',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Unique key for the section within the template',
    example: 'personal_info',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, {
    message: 'Key must be lowercase alphanumeric with underscores only',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Section description',
    example: 'Enter your personal details',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
