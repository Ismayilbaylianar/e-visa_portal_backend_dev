import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateFieldResponseDto {
  @ApiProperty({ description: 'Field ID' })
  id: string;

  @ApiProperty({ description: 'Template section ID' })
  templateSectionId: string;

  @ApiProperty({ description: 'Unique field key within the section' })
  fieldKey: string;

  @ApiProperty({ description: 'Field type (text, email, date, select, etc.)' })
  fieldType: string;

  @ApiProperty({ description: 'Field label displayed to users' })
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text for the field' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text displayed below the field' })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value for the field' })
  defaultValue?: string;

  @ApiProperty({ description: 'Whether the field is required' })
  isRequired: boolean;

  @ApiProperty({ description: 'Sort order within the section' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the field is active' })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Options for select/radio/checkbox fields (JSON)',
  })
  optionsJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Validation rules for the field (JSON)',
  })
  validationRulesJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Visibility rules for conditional display (JSON)',
  })
  visibilityRulesJson?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
