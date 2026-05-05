import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@/common/enums';

export class PaymentReconciliationDto {
  @ApiProperty({ description: 'Reconciliation ID' })
  id: string;

  @ApiProperty({ description: 'Reconciliation status' })
  reconciliationStatus: string;

  @ApiPropertyOptional({ description: 'Provider reported amount' })
  providerReportedAmount?: string;

  @ApiPropertyOptional({ description: 'Provider reported currency code' })
  providerReportedCurrencyCode?: string;

  @ApiPropertyOptional({ description: 'Provider reported status' })
  providerReportedStatus?: string;

  @ApiPropertyOptional({ description: 'When reconciliation was checked' })
  checkedAt?: Date;

  @ApiPropertyOptional({ description: 'Note' })
  note?: string;
}

export class PaymentPortalIdentityDto {
  @ApiProperty({ description: 'Portal identity ID' })
  id: string;

  @ApiProperty({ description: 'Buyer email used to log in to the portal' })
  email: string;
}

export class PaymentApplicationDto {
  @ApiProperty({ description: 'Application ID' })
  id: string;

  @ApiProperty({ description: 'Portal identity ID' })
  portalIdentityId: string;

  @ApiProperty({ description: 'Current application status' })
  currentStatus: string;

  @ApiProperty({ description: 'Application payment status' })
  paymentStatus: string;

  @ApiProperty({ description: 'Total fee amount' })
  totalFeeAmount: string;

  @ApiProperty({ description: 'Currency code' })
  currencyCode: string;

  @ApiPropertyOptional({
    description:
      'M11.3 — buyer portal identity (email) eager-loaded on the admin payment list/detail responses. Omitted on portal-facing endpoints where the user already knows their own email.',
    type: () => PaymentPortalIdentityDto,
  })
  portalIdentity?: PaymentPortalIdentityDto;
}

export class PaymentTransactionDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction type' })
  transactionType: string;

  @ApiProperty({ description: 'Transaction status' })
  transactionStatus: string;

  @ApiProperty({ description: 'Internal transaction reference' })
  internalTransactionReference: string;

  @ApiPropertyOptional({ description: 'Provider transaction reference' })
  providerTransactionReference?: string;

  @ApiPropertyOptional({ description: 'Provider event key' })
  providerEventKey?: string;

  @ApiPropertyOptional({ description: 'Error code' })
  errorCode?: string;

  @ApiPropertyOptional({ description: 'Error message' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Processed timestamp' })
  processedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class PaymentCallbackDto {
  @ApiProperty({ description: 'Callback ID' })
  id: string;

  @ApiProperty({ description: 'Provider key' })
  providerKey: string;

  @ApiProperty({ description: 'Callback type' })
  callbackType: string;

  @ApiPropertyOptional({ description: 'Provider event ID' })
  providerEventId?: string;

  @ApiProperty({ description: 'Signature validation status' })
  signatureValidationStatus: string;

  @ApiProperty({ description: 'Processing status' })
  processingStatus: string;

  @ApiPropertyOptional({ description: 'Error message' })
  errorMessage?: string;

  @ApiProperty({ description: 'Received timestamp' })
  receivedAt: Date;

  @ApiPropertyOptional({ description: 'Processed timestamp' })
  processedAt?: Date;
}

export class PaymentStatusHistoryDto {
  @ApiProperty({ description: 'History entry ID' })
  id: string;

  @ApiProperty({ description: 'Old status', enum: PaymentStatus })
  oldStatus: PaymentStatus;

  @ApiProperty({ description: 'New status', enum: PaymentStatus })
  newStatus: PaymentStatus;

  @ApiPropertyOptional({ description: 'Change reason' })
  changeReason?: string;

  @ApiPropertyOptional({ description: 'Changed by user ID' })
  changedByUserId?: string;

  @ApiProperty({ description: 'Changed by system flag' })
  changedBySystem: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Application ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  applicationId: string;

  @ApiProperty({
    description: 'Unique payment reference',
    example: 'PAY-2024-001234',
  })
  paymentReference: string;

  @ApiProperty({
    description: 'Payment provider key',
    example: 'stripe',
  })
  paymentProviderKey: string;

  @ApiPropertyOptional({
    description: 'Payment method key',
    example: 'card',
  })
  paymentMethodKey?: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Government fee amount',
    example: '50.00',
  })
  governmentFeeAmount: string;

  @ApiProperty({
    description: 'Service fee amount',
    example: '25.00',
  })
  serviceFeeAmount: string;

  @ApiPropertyOptional({
    description: 'Expedited fee amount',
    example: '30.00',
  })
  expeditedFeeAmount?: string;

  @ApiProperty({
    description: 'Total amount',
    example: '105.00',
  })
  totalAmount: string;

  @ApiProperty({
    description: 'Payable amount',
    example: '105.00',
  })
  payableAmount: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Provider payment ID',
    example: 'pi_1234567890',
  })
  providerPaymentId?: string;

  @ApiPropertyOptional({
    description: 'Provider session ID',
    example: 'cs_1234567890',
  })
  providerSessionId?: string;

  @ApiPropertyOptional({
    description: 'Provider order ID',
    example: 'order_1234567890',
  })
  providerOrderId?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key',
    example: 'idem_1234567890',
  })
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Payment expiration timestamp',
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment completion timestamp',
  })
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment failure timestamp',
  })
  failedAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment cancellation timestamp',
  })
  cancelledAt?: Date;

  @ApiPropertyOptional({
    type: PaymentApplicationDto,
    description: 'Associated application details',
  })
  application?: PaymentApplicationDto;

  @ApiPropertyOptional({
    type: [PaymentTransactionDto],
    description: 'Payment transactions',
  })
  transactions?: PaymentTransactionDto[];

  @ApiPropertyOptional({
    type: [PaymentCallbackDto],
    description: 'Payment callbacks',
  })
  callbacks?: PaymentCallbackDto[];

  @ApiPropertyOptional({
    type: [PaymentStatusHistoryDto],
    description: 'Payment status history',
  })
  statusHistory?: PaymentStatusHistoryDto[];

  @ApiPropertyOptional({
    type: PaymentReconciliationDto,
    description: 'Latest reconciliation record',
  })
  reconciliation?: PaymentReconciliationDto;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
