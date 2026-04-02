import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentPageConfigResponseDto {
  @ApiProperty({ description: 'Config ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Page title', example: 'Payment Information' })
  title: string;

  @ApiPropertyOptional({ description: 'Page description', example: 'Review payment details' })
  description?: string;

  @ApiProperty({
    description: 'Page sections configuration',
    example: [{ key: 'summary', title: 'Payment Summary', fields: [] }],
  })
  sectionsJson: any;

  @ApiProperty({ description: 'Whether config is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
