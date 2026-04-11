import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FIELD_TYPES } from '@/modules/templates/dto';

export class TemplateFieldResponseDto {
  @ApiProperty({ description: 'Field ID' })
  id: string;

  @ApiProperty({ description: 'Template section ID this field belongs to' })
  templateSectionId: string;

  @ApiProperty({
    description: 'Unique field key within the template (used as form field name)',
    example: 'firstName',
  })
  fieldKey: string;

  @ApiProperty({
    description: 'Field type',
    enum: FIELD_TYPES,
    example: 'text',
  })
  fieldType: string;

  @ApiProperty({ description: 'Field label displayed to users', example: 'First Name' })
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text for the field' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text displayed below the field' })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value for the field' })
  defaultValue?: string;

  @ApiProperty({ description: 'Whether the field is required', example: true })
  isRequired: boolean;

  @ApiProperty({ description: 'Sort order within the section', example: 1 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the field is active', example: true })
  isActive: boolean;

  @ApiProperty({
    description: 'Options for select/radio/checkbox fields',
    example: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
    ],
    type: 'array',
  })
  optionsJson: any[];

  @ApiPropertyOptional({
    description: 'Validation rules for the field',
    example: { minLength: 2, maxLength: 50 },
  })
  validationRulesJson?: Record<string, any> | null;

  @ApiProperty({
    description: 'Visibility rules for conditional display',
    example: [{ sourceFieldKey: 'isExpedited', operator: 'equals', value: 'true' }],
    type: 'array',
  })
  visibilityRulesJson: any[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
