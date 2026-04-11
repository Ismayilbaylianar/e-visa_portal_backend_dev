import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentInitializationRequest,
  PaymentInitializationResponse,
  PaymentStatusCheckRequest,
  PaymentStatusCheckResponse,
  CallbackValidationRequest,
  CallbackValidationResponse,
} from './payment-provider.interface';
import { randomBytes } from 'crypto';

/**
 * Mock Payment Provider
 *
 * Used for development and testing purposes.
 * Simulates payment provider behavior without actual external calls.
 *
 * Behavior:
 * - Returns fake session IDs and redirect URLs
 * - Simulates successful payment initialization
 * - Validates callbacks by checking for specific test patterns
 * - Status checks return pending by default (can be overridden via callback)
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly providerKey = 'mockProvider';

  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async initializePayment(
    request: PaymentInitializationRequest,
  ): Promise<PaymentInitializationResponse> {
    this.logger.log(`[MOCK] Initializing payment: ${request.paymentReference}`);

    // Generate mock provider IDs
    const sessionId = `mock_sess_${randomBytes(8).toString('hex')}`;
    const paymentId = `mock_pay_${randomBytes(8).toString('hex')}`;
    const orderId = `mock_ord_${randomBytes(8).toString('hex')}`;

    // Generate mock redirect URL
    const redirectUrl = `${this.baseUrl}/mock-payment/checkout?session=${sessionId}&ref=${request.paymentReference}`;

    this.logger.log(
      `[MOCK] Payment initialized: sessionId=${sessionId}, redirectUrl=${redirectUrl}`,
    );

    return {
      success: true,
      providerSessionId: sessionId,
      providerPaymentId: paymentId,
      providerOrderId: orderId,
      redirectUrl,
    };
  }

  async checkPaymentStatus(
    request: PaymentStatusCheckRequest,
  ): Promise<PaymentStatusCheckResponse> {
    this.logger.log(`[MOCK] Checking payment status: ${request.paymentId}`);

    // In mock mode, always return pending unless overridden
    // Real implementation would call provider API
    return {
      success: true,
      status: 'pending',
      providerStatus: 'awaiting_payment',
    };
  }

  async validateCallback(request: CallbackValidationRequest): Promise<CallbackValidationResponse> {
    this.logger.log('[MOCK] Validating callback');

    const { payload } = request;

    // Mock validation - accept all callbacks with required fields
    const paymentReference = payload.paymentReference || payload.payment_reference;
    const eventType = payload.type || payload.event_type || 'payment.status';
    const status = payload.status || payload.payment_status;

    if (!paymentReference) {
      return {
        isValid: false,
        errorMessage: 'Missing payment reference in callback payload',
      };
    }

    // Map mock status to internal status
    let mappedStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | undefined;
    if (status) {
      const statusMap: Record<string, 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'> =
        {
          pending: 'pending',
          processing: 'processing',
          paid: 'paid',
          completed: 'paid',
          success: 'paid',
          failed: 'failed',
          failure: 'failed',
          cancelled: 'cancelled',
          canceled: 'cancelled',
        };
      mappedStatus = statusMap[status.toLowerCase()];
    }

    return {
      isValid: true,
      paymentReference,
      providerPaymentId: payload.providerPaymentId || payload.provider_payment_id,
      eventType,
      status: mappedStatus,
    };
  }
}
