import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailTemplateResponseDto {
  @ApiProperty({ description: 'Template ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Template key', example: 'applicationSubmitted' })
  templateKey: string;

  @ApiProperty({ description: 'Email subject', example: 'Your application has been submitted' })
  subject: string;

  @ApiProperty({ description: 'HTML body', example: '<p>Hello {{fullName}}</p>' })
  bodyHtml: string;

  @ApiPropertyOptional({ description: 'Plain text body', example: 'Hello {{fullName}}' })
  bodyText?: string;

  @ApiProperty({ description: 'Whether template is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class EmailTemplateListResponseDto {
  @ApiProperty({ type: [EmailTemplateResponseDto], description: 'List of email templates' })
  items: EmailTemplateResponseDto[];

  @ApiProperty({ description: 'Total count', example: 5 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}
