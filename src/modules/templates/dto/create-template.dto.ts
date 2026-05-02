import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Template name',
    example: 'Tourist Visa Application',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description:
      'Unique template key. Must start with a lowercase letter and contain only letters, digits, and underscores. Matches the camelCase convention used by seeded templates (tourismStandardV1, businessStandardV1, transitSimpleV1).',
    example: 'tourismStandardV1',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z][a-zA-Z0-9_]*$/, {
    message:
      'Key must start with a lowercase letter and contain only letters, digits, and underscores',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Standard tourist visa application form template',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Template version',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
