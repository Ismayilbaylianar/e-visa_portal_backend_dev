import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';

export class CreateTemplateFieldDto {
  @ApiProperty({
    description: 'Unique field key within the section',
    example: 'first_name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldKey: string;

  @ApiProperty({
    description: 'Field type (text, email, date, select, etc.)',
    example: 'text',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  fieldType: string;

  @ApiProperty({
    description: 'Field label displayed to users',
    example: 'First Name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({
    description: 'Placeholder text for the field',
    example: 'Enter your first name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Help text displayed below the field',
    example: 'As it appears on your passport',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @ApiPropertyOptional({
    description: 'Default value for the field',
    example: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  defaultValue?: string;

  @ApiPropertyOptional({
    description: 'Whether the field is required',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order within the section',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the field is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Options for select/radio/checkbox fields (JSON)',
    example: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
  })
  @IsOptional()
  @IsObject()
  optionsJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Validation rules for the field (JSON)',
    example: { minLength: 2, maxLength: 50, pattern: '^[a-zA-Z]+$' },
  })
  @IsOptional()
  @IsObject()
  validationRulesJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Visibility rules for conditional display (JSON)',
    example: { dependsOn: 'has_visa', showWhen: true },
  })
  @IsOptional()
  @IsObject()
  visibilityRulesJson?: Record<string, any>;
}
