import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetFormSchemaQueryDto {
  @ApiProperty({
    description: 'Template binding ID to get the form schema for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  bindingId: string;
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

  @ApiProperty({ description: 'Field key' })
  key: string;

  @ApiProperty({ description: 'Field label' })
  label: string;

  @ApiProperty({ description: 'Field type (text, select, date, etc.)' })
  type: string;

  @ApiProperty({ description: 'Whether the field is required' })
  required: boolean;

  @ApiPropertyOptional({ description: 'Field placeholder' })
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Field help text' })
  helpText?: string;

  @ApiPropertyOptional({ description: 'Validation pattern (regex)' })
  validationPattern?: string;

  @ApiPropertyOptional({ description: 'Validation error message' })
  validationMessage?: string;

  @ApiPropertyOptional({ description: 'Minimum value/length' })
  min?: number;

  @ApiPropertyOptional({ description: 'Maximum value/length' })
  max?: number;

  @ApiPropertyOptional({
    type: [FormFieldOptionDto],
    description: 'Options for select/radio fields',
  })
  options?: FormFieldOptionDto[];

  @ApiProperty({ description: 'Field display order' })
  order: number;
}

export class FormSectionDto {
  @ApiProperty({ description: 'Section ID' })
  id: string;

  @ApiProperty({ description: 'Section key' })
  key: string;

  @ApiProperty({ description: 'Section title' })
  title: string;

  @ApiPropertyOptional({ description: 'Section description' })
  description?: string;

  @ApiProperty({ description: 'Section display order' })
  order: number;

  @ApiProperty({
    type: [FormFieldDto],
    description: 'Fields in this section',
  })
  fields: FormFieldDto[];
}

export class FormSchemaResponseDto {
  @ApiProperty({ description: 'Template ID' })
  templateId: string;

  @ApiProperty({ description: 'Template name' })
  templateName: string;

  @ApiProperty({ description: 'Template key' })
  templateKey: string;

  @ApiProperty({ description: 'Template version' })
  templateVersion: number;

  @ApiProperty({
    type: [FormSectionDto],
    description: 'Form sections with fields',
  })
  sections: FormSectionDto[];
}
