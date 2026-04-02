import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Unique template key (camelCase)',
    example: 'applicationApproved',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Template key must be at least 2 characters' })
  @MaxLength(100, { message: 'Template key must not exceed 100 characters' })
  @Matches(/^[a-z][a-zA-Z0-9]*$/, {
    message: 'Template key must be camelCase (start with lowercase, alphanumeric only)',
  })
  templateKey?: string;

  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Application submission confirmation',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Subject must be at least 2 characters' })
  @MaxLength(500, { message: 'Subject must not exceed 500 characters' })
  subject?: string;

  @ApiPropertyOptional({
    description: 'HTML body content',
    example: '<p>Updated HTML content</p>',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'HTML body cannot be empty' })
  bodyHtml?: string;

  @ApiPropertyOptional({
    description: 'Plain text body content',
    example: 'Updated plain text content',
  })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
