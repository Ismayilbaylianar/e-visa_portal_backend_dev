import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({
    description: 'Unique template key (camelCase)',
    example: 'applicationSubmitted',
  })
  @IsString()
  @MinLength(2, { message: 'Template key must be at least 2 characters' })
  @MaxLength(100, { message: 'Template key must not exceed 100 characters' })
  @Matches(/^[a-z][a-zA-Z0-9]*$/, {
    message: 'Template key must be camelCase (start with lowercase, alphanumeric only)',
  })
  templateKey: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Your application has been submitted',
  })
  @IsString()
  @MinLength(2, { message: 'Subject must be at least 2 characters' })
  @MaxLength(500, { message: 'Subject must not exceed 500 characters' })
  subject: string;

  @ApiProperty({
    description: 'HTML body content (supports template variables like {{fullName}})',
    example: '<p>Hello {{fullName}}, your application is submitted.</p>',
  })
  @IsString()
  @MinLength(1, { message: 'HTML body is required' })
  bodyHtml: string;

  @ApiPropertyOptional({
    description: 'Plain text body content (fallback for non-HTML clients)',
    example: 'Hello {{fullName}}, your application is submitted.',
  })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
