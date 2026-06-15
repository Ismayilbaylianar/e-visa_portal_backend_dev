/**
 * Payment Provider Interface
 *
 * Defines the contract for payment provider implementations.
 * Each provider (mockProvider now, MSolution later) must implement this interface.
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

/**
 * Payment Stage 2 — authorize/capture/release/refund actions.
 * A generic request/response for the lifecycle operations the mock
 * provider simulates and the future real MSolution provider will map to
 * its gateway. `amount` is used by capture/refund; for a full-portion
 * refund the service passes the portion amount it is refunding.
 */
export interface PaymentActionRequest {
  paymentId: string;
  providerPaymentId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface PaymentActionResponse {
  success: boolean;
  providerReference?: string;
  errorCode?: string;
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

  /**
   * Payment Stage 2 — authorize/hold funds on the card (no capture).
   */
  authorize(request: PaymentActionRequest): Promise<PaymentActionResponse>;

  /**
   * Payment Stage 2 — capture previously-authorized funds (settlement).
   */
  capture(request: PaymentActionRequest): Promise<PaymentActionResponse>;

  /**
   * Payment Stage 2 — release/void an authorization (no charge).
   */
  release(request: PaymentActionRequest): Promise<PaymentActionResponse>;

  /**
   * Payment Stage 2 — refund a captured amount (a single fee portion in
   * full, per the selective-refund model).
   */
  refund(request: PaymentActionRequest): Promise<PaymentActionResponse>;
}
