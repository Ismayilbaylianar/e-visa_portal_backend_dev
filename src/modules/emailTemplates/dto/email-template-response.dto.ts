import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailTemplateResponseDto {
  @ApiProperty({
    description: 'Email template UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Unique template key identifier',
    example: 'APPLICATION_APPROVED',
  })
  templateKey: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Your visa application has been approved',
  })
  subject: string;

  @ApiProperty({
    description: 'HTML body of the email',
    example: '<h1>Congratulations!</h1><p>Your visa has been approved.</p>',
  })
  bodyHtml: string;

  @ApiPropertyOptional({
    description: 'Plain text body of the email',
    example: 'Congratulations! Your visa has been approved.',
  })
  bodyText?: string;

  @ApiProperty({
    description: 'Whether the template is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'When the template was created',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the template was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
