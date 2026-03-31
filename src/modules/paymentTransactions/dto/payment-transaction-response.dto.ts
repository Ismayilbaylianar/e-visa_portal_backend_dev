import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class PaymentTransactionResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: 'AUTHORIZATION',
  })
  transactionType: TransactionType;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: 'SUCCESS',
  })
  transactionStatus: TransactionStatus;

  @ApiProperty({
    description: 'Internal transaction reference',
    example: 'TXN-20240115-ABC123',
  })
  internalTransactionReference: string;

  @ApiPropertyOptional({
    description: 'Provider transaction reference',
    example: 'pi_3NkRV2BrXYZ',
  })
  providerTransactionReference?: string;

  @ApiPropertyOptional({
    description: 'Provider event key',
    example: 'payment_intent.succeeded',
  })
  providerEventKey?: string;

  @ApiPropertyOptional({
    description: 'Request payload JSON',
  })
  requestPayloadJson?: any;

  @ApiPropertyOptional({
    description: 'Response payload JSON',
  })
  responsePayloadJson?: any;

  @ApiPropertyOptional({
    description: 'Error code',
    example: 'card_declined',
  })
  errorCode?: string;

  @ApiPropertyOptional({
    description: 'Error message',
    example: 'Your card was declined',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Processing timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;
}
