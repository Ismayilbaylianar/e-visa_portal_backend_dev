/**
 * Payment Provider Interface
 *
 * Defines the contract for payment provider implementations.
 * Each provider (mock, stripe, paypal, etc.) must implement this interface.
 */
export interface PaymentInitializationRequest {
  paymentId: string;
  paymentReference: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInitializationResponse {
  success: boolean;
  providerSessionId?: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  redirectUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentStatusCheckRequest {
  paymentId: string;
  providerPaymentId?: string;
  providerSessionId?: string;
}

export interface PaymentStatusCheckResponse {
  success: boolean;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'expired';
  providerStatus?: string;
  paidAmount?: number;
  paidCurrency?: string;
  paidAt?: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface CallbackValidationRequest {
  headers: Record<string, string>;
  payload: any;
  rawBody?: string;
}

export interface CallbackValidationResponse {
  isValid: boolean;
  paymentReference?: string;
  providerPaymentId?: string;
  eventType?: string;
  status?: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  errorMessage?: string;
}

export interface PaymentProvider {
  /**
   * Provider key identifier
   */
  readonly providerKey: string;

  /**
   * Initialize a payment session with the provider
   */
  initializePayment(request: PaymentInitializationRequest): Promise<PaymentInitializationResponse>;

  /**
   * Check payment status with the provider
   */
  checkPaymentStatus(request: PaymentStatusCheckRequest): Promise<PaymentStatusCheckResponse>;

  /**
   * Validate and parse callback/webhook from provider
   */
  validateCallback(request: CallbackValidationRequest): Promise<CallbackValidationResponse>;
}
