import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetFormSchemaQueryDto {
  @ApiPropertyOptional({
    description: 'Template binding ID to get the form schema for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  templateBindingId?: string;

  @ApiPropertyOptional({
    description: "Application ID to get the form schema for (uses application's resolved template)",
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({
    description:
      'Applicant ID to get the form schema for (verifies ownership through related application)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  applicantId?: string;
}

export class FormFieldOptionDto {
  @ApiProperty({ description: 'Option value' })
  value: string;

  @ApiProperty({ description: 'Option label' })
  label: string;
}

export class FormFieldDto {
  @ApiProperty({ description: 'Field ID' })
  id: string;

  @ApiProperty({ description: 'Field key (unique within template)' })
  fieldKey: string;

  @ApiProperty({ description: 'Field type (text, select, date, file, etc.)' })
  fieldType: string;

  @ApiProperty({ description: 'Field label' })
  label: string;

  @ApiPropertyOptional({ description: 'Field placeholder' })
  placeholder?: string | null;

  @ApiPropertyOptional({ description: 'Field help text' })
  helpText?: string | null;

  @ApiPropertyOptional({ description: 'Default value' })
  defaultValue?: string | null;

  @ApiProperty({ description: 'Whether the field is required' })
  isRequired: boolean;

  @ApiProperty({ description: 'Field display order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether the field is active' })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Options for select/radio/checkbox fields',
    example: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
  })
  optionsJson?: any[];

  @ApiPropertyOptional({
    description: 'Validation rules (minLength, maxLength, pattern, etc.)',
    example: { minLength: 2, maxLength: 50 },
  })
  validationRulesJson?: Record<string, any> | null;

  @ApiPropertyOptional({
    description: 'Visibility rules for conditional display',
    example: [],
  })
  visibilityRulesJson?: any[] | null;
}

export class FormSectionDto {
  @ApiProperty({ description: 'Section ID' })
  id: string;

  @ApiProperty({ description: 'Section title' })
  title: string;

  @ApiProperty({ description: 'Section key (unique within template)' })
  key: string;

  @ApiPropertyOptional({ description: 'Section description' })
  description?: string | null;

  @ApiProperty({ description: 'Section display order' })
  sortOrder: number;

  @ApiProperty({
    type: [FormFieldDto],
    description: 'Fields in this section (ordered by sortOrder)',
  })
  fields: FormFieldDto[];
}

export class FormSchemaResponseDto {
  @ApiProperty({ description: 'Template ID' })
  templateId: string;

  @ApiPropertyOptional({ description: 'Template name' })
  templateName?: string;

  @ApiPropertyOptional({ description: 'Template key' })
  templateKey?: string;

  @ApiProperty({
    type: [FormSectionDto],
    description: 'Form sections with fields (ordered by sortOrder)',
  })
  sections: FormSectionDto[];
}
