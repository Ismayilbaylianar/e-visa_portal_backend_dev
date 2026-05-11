import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  IsIn,
  IsArray,
  IsObject,
  ValidateIf,
  Matches,
  Allow,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FIELD_TYPES } from '@/modules/templates/dto';

/**
 * DTO for creating a template field
 * fieldKey must be unique within the entire template (across all sections)
 */
export class CreateTemplateFieldDto {
  @ApiProperty({
    description:
      'Unique field key within the template (used as form field name). Must be camelCase or snake_case.',
    example: 'firstName',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: 'fieldKey must start with a letter and contain only letters, numbers, and underscores',
  })
  fieldKey: string;

  @ApiProperty({
    description: 'Field type',
    enum: FIELD_TYPES,
    example: 'text',
  })
  @IsString()
  @IsIn(FIELD_TYPES, {
    message: `fieldType must be one of: ${FIELD_TYPES.join(', ')}`,
  })
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
    description: 'Sort order within the section (non-negative integer)',
    default: 0,
    minimum: 0,
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
    description: 'Options for select/radio/checkbox fields. Array of {label, value} objects.',
    example: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
    ],
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  // M11.14 (BUG BB) — Tell class-transformer to keep each inner
  // entry as a plain Object. Without @Type, the inline inline
  // shape `{label, value}` was making class-transformer (via
  // plainToInstance + transform:true) coerce each object into
  // an empty array — the service then received `[[],[],[]]` and
  // (correctly, semantically) rejected the field for having no
  // valid options. With `@Type(() => Object)` the inner records
  // pass through unchanged; the service's option-shape check
  // does the real validation.
  @Type(() => Object)
  optionsJson?: any[];

  @ApiPropertyOptional({
    description:
      'Validation rules for the field (JSON object). Supported rules depend on fieldType.',
    example: { minLength: 2, maxLength: 50 },
    examples: {
      text: { value: { minLength: 2, maxLength: 50, pattern: '^[a-zA-Z]+$' } },
      number: { value: { min: 0, max: 100 } },
      file: { value: { allowedFileTypes: ['application/pdf', 'image/jpeg'], maxFileSizeMb: 10 } },
    },
  })
  @IsOptional()
  @ValidateIf(o => o.validationRulesJson !== null)
  @IsObject()
  validationRulesJson?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Visibility rules for conditional display. Array of condition objects.',
    example: [{ sourceFieldKey: 'isExpedited', operator: 'equals', value: 'true' }],
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  visibilityRulesJson?: Array<{
    sourceFieldKey: string;
    operator: string;
    value: string;
  }>;
}
