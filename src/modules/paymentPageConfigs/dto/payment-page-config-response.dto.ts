import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentPageConfigResponseDto {
  @ApiProperty({
    description: 'Config ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Page title',
    example: 'Complete Your Payment',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Page description',
    example: 'Please review your order and complete the payment',
  })
  description?: string;

  @ApiProperty({
    description: 'Page sections configuration as JSON',
    example: [{ type: 'summary', title: 'Order Summary' }],
  })
  sectionsJson: any;

  @ApiProperty({
    description: 'Whether the config is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
