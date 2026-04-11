import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@/common/enums';

export class InitializePaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  paymentId: string;

  @ApiPropertyOptional({
    description: 'Provider session ID for tracking',
    example: 'mock_sess_abc123',
  })
  providerSessionId: string | null;

  @ApiPropertyOptional({
    description: 'Redirect URL for payment page',
    example: 'https://mock-payment.local/checkout/pay_1',
  })
  redirectUrl: string | null;

  @ApiProperty({
    description: 'Current payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;
}
