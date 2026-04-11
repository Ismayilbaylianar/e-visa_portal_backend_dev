import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FIELD_TYPES } from '@/modules/templates/dto';

export class SectionFieldResponseDto {
  @ApiProperty({ description: 'Field ID' })
  id: string;

  @ApiProperty({ description: 'Field key (unique within template)', example: 'firstName' })
  fieldKey: string;

  @ApiProperty({
    description: 'Field type',
    enum: FIELD_TYPES,
    example: 'text',
  })
  fieldType: string;

  @ApiProperty({ description: 'Field label', example: 'First Name' })
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text' })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value' })
  defaultValue?: string;

  @ApiProperty({ description: 'Whether field is required' })
  isRequired: boolean;

  @ApiProperty({ description: 'Sort order within section' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether field is active' })
  isActive: boolean;

  @ApiProperty({
    description: 'Options for select/radio/checkbox fields',
    type: 'array',
  })
  optionsJson: any[];

  @ApiPropertyOptional({ description: 'Validation rules (JSON object)' })
  validationRulesJson?: Record<string, any> | null;

  @ApiProperty({
    description: 'Visibility rules for conditional display',
    type: 'array',
  })
  visibilityRulesJson: any[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class TemplateSectionResponseDto {
  @ApiProperty({ description: 'Section ID' })
  id: string;

  @ApiProperty({ description: 'Template ID this section belongs to' })
  templateId: string;

  @ApiProperty({ description: 'Section title', example: 'Personal Info' })
  title: string;

  @ApiProperty({ description: 'Section key (unique within template)', example: 'personalInfo' })
  key: string;

  @ApiPropertyOptional({ description: 'Section description' })
  description?: string;

  @ApiProperty({ description: 'Sort order within template' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether section is active' })
  isActive: boolean;

  @ApiProperty({
    type: [SectionFieldResponseDto],
    description: 'Section fields ordered by sortOrder',
  })
  fields: SectionFieldResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
