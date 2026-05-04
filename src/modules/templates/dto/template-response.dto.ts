import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Supported field types for template fields
 */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'date',
  'file',
  'email',
  'phone',
  'number',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export class TemplateFieldResponseDto {
  @ApiProperty({ description: 'Field ID', example: 'fld_550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Field key (unique within template)', example: 'firstName' })
  fieldKey: string;

  @ApiProperty({
    description: 'Field type',
    enum: FIELD_TYPES,
    example: 'text',
  })
  fieldType: string;

  @ApiProperty({ description: 'Field label displayed to users', example: 'First Name' })
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text', example: 'Enter first name' })
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Help text displayed below the field',
    example: 'As it appears on your passport',
  })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value for the field' })
  defaultValue?: string;

  @ApiProperty({ description: 'Whether field is required', example: true })
  isRequired: boolean;

  @ApiProperty({ description: 'Sort order within the section', example: 1 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether field is active', example: true })
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

export class TemplateSectionResponseDto {
  @ApiProperty({ description: 'Section ID', example: 'sec_550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Section title', example: 'Personal Info' })
  title: string;

  @ApiProperty({ description: 'Section key (unique within template)', example: 'personalInfo' })
  key: string;

  @ApiPropertyOptional({
    description: 'Section description',
    example: 'Basic applicant identity information',
  })
  description?: string;

  @ApiProperty({ description: 'Sort order within the template', example: 1 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether section is active', example: true })
  isActive: boolean;

  @ApiProperty({
    type: [TemplateFieldResponseDto],
    description: 'Section fields ordered by sortOrder',
  })
  fields: TemplateFieldResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class TemplateResponseDto {
  @ApiProperty({ description: 'Template ID', example: 'tpl_550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Template name', example: 'Tourism Visa Main Form' })
  name: string;

  @ApiProperty({ description: 'Unique template key', example: 'tourismVisaMainForm' })
  key: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Main application form for tourism visa',
  })
  description?: string;

  @ApiProperty({
    description: 'Template version (initialized to 1, not auto-incremented)',
    example: 1,
  })
  version: number;

  @ApiProperty({ description: 'Whether template is active', example: true })
  isActive: boolean;

  @ApiProperty({
    description:
      'M11.2 — true for blueprint templates seeded with industry-standard fields. ' +
      'Boilerplates are read-only sources for `POST /admin/templates/:id/duplicate` and ' +
      'never bound to nationalities.',
    example: false,
  })
  isBoilerplate: boolean;

  @ApiProperty({
    type: [TemplateSectionResponseDto],
    description: 'Template sections ordered by sortOrder, each containing fields',
  })
  sections: TemplateSectionResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

/**
 * List item response for templates (summary without nested sections/fields)
 */
export class TemplateListItemResponseDto {
  @ApiProperty({ description: 'Template ID' })
  id: string;

  @ApiProperty({ description: 'Template name', example: 'Tourism Visa Main Form' })
  name: string;

  @ApiProperty({ description: 'Unique template key', example: 'tourismVisaMainForm' })
  key: string;

  @ApiPropertyOptional({ description: 'Template description' })
  description?: string;

  @ApiProperty({ description: 'Template version', example: 1 })
  version: number;

  @ApiProperty({ description: 'Whether template is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Number of sections in the template', example: 3 })
  sectionsCount: number;

  @ApiProperty({
    description:
      'M11.2 — boilerplate flag. UI uses this to surface the "Create from boilerplate" picker.',
    example: false,
  })
  isBoilerplate: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
