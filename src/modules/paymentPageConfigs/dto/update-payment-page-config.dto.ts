import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentPageFieldDto {
  @ApiPropertyOptional({ description: 'Field key', example: 'notes' })
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @ApiPropertyOptional({ description: 'Field type', example: 'textarea' })
  @IsOptional()
  @IsString()
  fieldType?: string;

  @ApiPropertyOptional({ description: 'Field label', example: 'Notes' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Whether field is required', example: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class PaymentPageSectionDto {
  @ApiPropertyOptional({ description: 'Section key', example: 'summary' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ description: 'Section title', example: 'Payment Summary' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Section fields', type: [PaymentPageFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentPageFieldDto)
  fields?: PaymentPageFieldDto[];
}

export class UpdatePaymentPageConfigDto {
  @ApiPropertyOptional({
    description: 'Page title',
    example: 'Payment Information',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Page description',
    example: 'Please review payment details before continuing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Page sections configuration (JSON)',
    type: [PaymentPageSectionDto],
    example: [
      {
        key: 'summary',
        title: 'Payment Summary',
        fields: [
          { fieldKey: 'notes', fieldType: 'textarea', label: 'Notes', isRequired: false },
        ],
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentPageSectionDto)
  sectionsJson?: PaymentPageSectionDto[];

  @ApiPropertyOptional({
    description: 'Whether the config is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
