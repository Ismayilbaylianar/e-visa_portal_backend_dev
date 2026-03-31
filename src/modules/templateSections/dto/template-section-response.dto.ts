import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateFieldResponseDto {
  @ApiProperty({ description: 'Field ID' })
  id: string;

  @ApiProperty({ description: 'Field key' })
  fieldKey: string;

  @ApiProperty({ description: 'Field type' })
  fieldType: string;

  @ApiProperty({ description: 'Field label' })
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text' })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value' })
  defaultValue?: string;

  @ApiProperty({ description: 'Whether field is required' })
  isRequired: boolean;

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether field is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Field options (JSON)' })
  optionsJson?: any;

  @ApiPropertyOptional({ description: 'Validation rules (JSON)' })
  validationRulesJson?: any;

  @ApiPropertyOptional({ description: 'Visibility rules (JSON)' })
  visibilityRulesJson?: any;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class TemplateSectionResponseDto {
  @ApiProperty({ description: 'Section ID' })
  id: string;

  @ApiProperty({ description: 'Template ID' })
  templateId: string;

  @ApiProperty({ description: 'Section title' })
  title: string;

  @ApiProperty({ description: 'Section key' })
  key: string;

  @ApiPropertyOptional({ description: 'Section description' })
  description?: string;

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether section is active' })
  isActive: boolean;

  @ApiPropertyOptional({
    type: [TemplateFieldResponseDto],
    description: 'Section fields',
  })
  fields?: TemplateFieldResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
