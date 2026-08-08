import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { NotificationEmitterService } from '../notifications/notification-emitter.service';
import {
  CreatePaymentDto,
  InitializePaymentDto,
  UpdatePaymentStatusDto,
  PaymentResponseDto,
  GetPaymentsQueryDto,
  PaymentTransactionDto,
  PaymentCallbackDto,
  InitializePaymentResponseDto,
} from './dto';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import { PaymentStatus, ApplicationStatus } from '@/common/enums';
import { PaymentProvider, MockPaymentProvider } from './providers';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paymentTimeoutHours: number;
  private readonly providers: Map<string, PaymentProvider> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(MockPaymentProvider) private readonly mockProvider: MockPaymentProvider,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationEmitter: NotificationEmitterService,
    // M11.10 (BUG 3) — needed by sendPaymentSuccessEmail.
    private readonly emailService: EmailService,
  ) {
    this.paymentTimeoutHours = this.configService.get<number>('PAYMENT_TIMEOUT_HOURS', 3);

    // Register providers
    this.providers.set(this.mockProvider.providerKey, this.mockProvider);
  }

  private getProvider(providerKey: string): PaymentProvider {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new BadRequestException('Unknown payment provider', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Provider '${providerKey}' is not supported` },
      ]);
    }
    return provider;
  }

  /**
   * Generate unique payment reference
   * Format: PAY-YYYY-NNNNNN (e.g., PAY-2026-000001)
   */
  private async generatePaymentReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;

    const lastPayment = await this.prisma.payment.findFirst({
      where: {
        paymentReference: {
          startsWith: prefix,
        },
      },
      orderBy: {
        paymentReference: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastPayment?.paymentReference) {
      const lastNumber = parseInt(lastPayment.paymentReference.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  private generateIdempotencyKey(): string {
    return randomBytes(16).toString('hex');
  }

  private generateTransactionReference(): string {
    return `TXN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async findAll(
    query: GetPaymentsQueryDto,
  ): Promise<{ items: PaymentResponseDto[]; pagination: PaginationMeta }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      applicationId,
      providerKey,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { paymentStatus: status }),
      ...(applicationId && { applicationId }),
      ...(providerKey && { paymentProviderKey: providerKey }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              // M11.10 BUG 4 + M11.11 BUG J — booking reference code
              // surfaced on the list so the new Reference column
              // (replacing the UUID slice) can render REF-YYYY-NNNNNN.
              referenceCode: true,
              portalIdentityId: true,
              currentStatus: true,
              paymentStatus: true,
              totalFeeAmount: true,
              currencyCode: true,
              // M11.3 — admin Transactions page renders the buyer
              // email. Including the portal identity here keeps the
              // list/detail responses self-sufficient (no per-row
              // hydration round-trips on the frontend).
              portalIdentity: { select: { id: true, email: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const items = payments.map(payment => this.mapToResponse(payment));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * M11.7 (B1) — Build a CSV body for the admin Transactions Export
   * button. Honours the same filter set as `findAll` but ignores the
   * `page`/`limit` so a single download covers everything matching.
   * Hard-capped at EXPORT_HARD_LIMIT rows to keep memory bounded.
   */
  async exportCsv(query: GetPaymentsQueryDto): Promise<string> {
    const EXPORT_HARD_LIMIT = 10000;
    const { status, applicationId, providerKey, dateFrom, dateTo } = query;
    const where = {
      deletedAt: null,
      ...(status && { paymentStatus: status }),
      ...(applicationId && { applicationId }),
      ...(providerKey && { paymentProviderKey: providerKey }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };
    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        application: {
          select: {
            id: true,
            currentStatus: true,
            portalIdentity: { select: { email: true } },
            destinationCountry: { select: { isoCode: true, name: true } },
            visaType: { select: { label: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: EXPORT_HARD_LIMIT,
    });

    const headers = [
      'Payment Reference',
      'Application Code',
      'Buyer Email',
      'Destination',
      'Visa Type',
      'Application Status',
      'Payment Status',
      'Provider',
      'Currency',
      'Total Amount',
      'Government Fee',
      'Service Fee',
      'Expedited Fee',
      'Created At',
      'Paid At',
    ];
    const lines = [headers.map(csvEscape).join(',')];
    for (const p of payments) {
      lines.push(
        [
          p.paymentReference ?? '',
          // Application code lives on ApplicationApplicant, not on
          // Payment. The export uses applicationId as the join surface
          // since that's what the page/back-link uses too.
          p.applicationId,
          p.application?.portalIdentity?.email ?? '',
          p.application?.destinationCountry
            ? `${p.application.destinationCountry.isoCode} ${p.application.destinationCountry.name}`
            : '',
          p.application?.visaType?.label ?? '',
          p.application?.currentStatus ?? '',
          p.paymentStatus ?? '',
          p.paymentProviderKey ?? '',
          p.currencyCode ?? '',
          p.totalAmount?.toString() ?? '',
          p.governmentFeeAmount?.toString() ?? '',
          p.serviceFeeAmount?.toString() ?? '',
          p.expeditedFeeAmount?.toString() ?? '',
          p.createdAt?.toISOString() ?? '',
          p.paidAt?.toISOString() ?? '',
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async findById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: {
        application: {
          select: {
            id: true,
            // M11.11 (BUG J) — booking ref + applicants list for the
            // new transaction detail page (Card 3 — Applications).
            referenceCode: true,
            portalIdentityId: true,
            currentStatus: true,
            paymentStatus: true,
            totalFeeAmount: true,
            currencyCode: true,
            portalIdentity: {
              select: { id: true, email: true },
            },
            applicants: {
              where: { deletedAt: null },
              orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                applicationCode: true,
                status: true,
                isMainApplicant: true,
                email: true,
                phone: true,
                formDataJson: true,
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
        callbacks: {
          orderBy: { receivedAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        reconciliation: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found' },
      ]);
    }

    return this.mapToResponse(payment);
  }

  async findByIdForPortal(id: string, portalIdentityId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        deletedAt: null,
        application: {
          portalIdentityId,
          deletedAt: null,
        },
      },
      include: {
        application: {
          select: {
            id: true,
            portalIdentityId: true,
            currentStatus: true,
            paymentStatus: true,
            totalFeeAmount: true,
            currencyCode: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found or access denied' },
      ]);
    }

    return this.mapToResponse(payment);
  }

  /**
   * Create a new payment for an application
   *
   * Duplicate Prevention Rule:
   * - Only one active (CREATED, PENDING, PROCESSING) payment per application is allowed
   * - If a PAID payment exists, no new payment can be created
   * - FAILED, EXPIRED, CANCELLED payments do not block new payment creation
   */
  async create(dto: CreatePaymentDto, portalIdentityId: string): Promise<PaymentResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: {
        id: dto.applicationId,
        portalIdentityId,
        deletedAt: null,
      },
      include: {
        templateBinding: {
          include: {
            nationalityFees: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application not found or access denied' },
      ]);
    }

    // Check application status - must be UNPAID or SUBMITTED (for retry scenarios)
    const allowedStatuses: string[] = [ApplicationStatus.UNPAID, ApplicationStatus.SUBMITTED];
    if (!allowedStatuses.includes(application.currentStatus)) {
      throw new BadRequestException('Application not eligible for payment', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: `Payment can only be created for applications in UNPAID or SUBMITTED status. Current status: ${application.currentStatus}`,
        },
      ]);
    }

    // Check for existing active payments (duplicate prevention)
    const activePaymentStatuses = [
      PaymentStatus.CREATED,
      PaymentStatus.PENDING,
      PaymentStatus.PROCESSING,
    ];

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        applicationId: dto.applicationId,
        paymentStatus: {
          in: [...activePaymentStatuses, PaymentStatus.PAID],
        },
        deletedAt: null,
      },
    });

    if (existingPayment) {
      if (existingPayment.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Application already paid', [
          {
            reason: ErrorCodes.CONFLICT,
            message: 'This application already has a completed payment',
          },
        ]);
      }

      // Check if existing payment has expired
      if (existingPayment.expiresAt && new Date() > existingPayment.expiresAt) {
        // Auto-expire the old payment
        await this.updatePaymentStatusInternal(
          existingPayment.id,
          PaymentStatus.EXPIRED,
          'Payment expired',
          true,
        );
      } else {
        throw new ConflictException('Active payment exists', [
          {
            reason: ErrorCodes.CONFLICT,
            message:
              'Application already has an active payment. Please complete or wait for it to expire.',
          },
        ]);
      }
    }

    // Get fee configuration
    const nationalityFee = application.templateBinding.nationalityFees.find(
      fee => fee.nationalityCountryId === application.nationalityCountryId,
    );

    if (!nationalityFee) {
      throw new BadRequestException('Fee configuration not found', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Fee configuration not found for this nationality',
        },
      ]);
    }

    // Calculate fee amounts (snapshot at payment creation time)
    const governmentFee = Number(nationalityFee.governmentFeeAmount);
    const serviceFee = Number(nationalityFee.serviceFeeAmount);
    const expeditedFee =
      application.expedited && nationalityFee.expeditedEnabled
        ? Number(nationalityFee.expeditedFeeAmount || 0)
        : 0;

    const totalAmount = governmentFee + serviceFee + expeditedFee;
    const payableAmount = totalAmount;

    // Calculate expiration time
    const expiresAt = application.paymentDeadlineAt
      ? new Date(application.paymentDeadlineAt)
      : new Date(Date.now() + this.paymentTimeoutHours * 60 * 60 * 1000);

    // Generate payment reference
    const paymentReference = await this.generatePaymentReference();

    const payment = await this.prisma.payment.create({
      data: {
        applicationId: dto.applicationId,
        paymentReference,
        paymentProviderKey: 'mockProvider',
        currencyCode: nationalityFee.currencyCode,
        governmentFeeAmount: governmentFee,
        serviceFeeAmount: serviceFee,
        expeditedFeeAmount: expeditedFee > 0 ? expeditedFee : null,
        totalAmount,
        payableAmount,
        paymentStatus: PaymentStatus.CREATED,
        idempotencyKey: this.generateIdempotencyKey(),
        expiresAt,
      },
      include: {
        application: {
          select: {
            id: true,
            portalIdentityId: true,
            currentStatus: true,
            paymentStatus: true,
            totalFeeAmount: true,
            currencyCode: true,
          },
        },
      },
    });

    // Create initial status history
    await this.prisma.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: PaymentStatus.CREATED,
        newStatus: PaymentStatus.CREATED,
        changeReason: 'Payment created',
        changedBySystem: true,
      },
    });

    this.logger.log(
      `Payment created: ${payment.id} (${paymentReference}) for application: ${dto.applicationId}`,
    );
    return this.mapToResponse(payment);
  }

  /**
   * Initialize payment with provider
   * Creates a transaction record and calls provider to get redirect URL
   */
  async initialize(
    id: string,
    dto: InitializePaymentDto,
    portalIdentityId: string,
  ): Promise<InitializePaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        deletedAt: null,
        application: {
          portalIdentityId,
          deletedAt: null,
        },
      },
      include: {
        application: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found or access denied' },
      ]);
    }

    // Check if payment can be initialized
    const initializableStatuses: string[] = [PaymentStatus.CREATED, PaymentStatus.PENDING];
    if (!initializableStatuses.includes(payment.paymentStatus)) {
      throw new BadRequestException('Payment cannot be initialized', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Payment in ${payment.paymentStatus} status cannot be initialized`,
        },
      ]);
    }

    // Check expiration
    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.updatePaymentStatusInternal(id, PaymentStatus.EXPIRED, 'Payment expired', true);
      throw new BadRequestException('Payment has expired', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Payment has expired. Please create a new payment.',
        },
      ]);
    }

    // Get provider
    const provider = this.getProvider(payment.paymentProviderKey);

    // Create initialization transaction
    const transactionRef = this.generateTransactionReference();

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        paymentId: id,
        transactionType: 'INITIALIZATION',
        transactionStatus: 'PENDING',
        internalTransactionReference: transactionRef,
        requestPayloadJson: {
          paymentMethodKey: dto.paymentMethodKey,
          amount: Number(payment.payableAmount),
          currency: payment.currencyCode,
        },
      },
    });

    try {
      // Call provider to initialize payment
      const providerResponse = await provider.initializePayment({
        paymentId: payment.id,
        paymentReference: payment.paymentReference,
        amount: Number(payment.payableAmount),
        currency: payment.currencyCode,
        description: `Payment for application ${payment.applicationId}`,
        metadata: {
          applicationId: payment.applicationId,
          paymentReference: payment.paymentReference,
        },
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
      });

      if (!providerResponse.success) {
        // Update transaction as failed
        await this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            transactionStatus: 'FAILED',
            errorCode: providerResponse.errorCode,
            errorMessage: providerResponse.errorMessage,
            processedAt: new Date(),
          },
        });

        throw new BadRequestException('Payment initialization failed', [
          {
            reason: ErrorCodes.PAYMENT_INITIALIZATION_FAILED,
            message: providerResponse.errorMessage || 'Provider initialization failed',
          },
        ]);
      }

      // Update payment with provider details and status
      const updatedPayment = await this.prisma.payment.update({
        where: { id },
        data: {
          paymentMethodKey: dto.paymentMethodKey,
          paymentStatus: PaymentStatus.PENDING,
          providerSessionId: providerResponse.providerSessionId,
          providerPaymentId: providerResponse.providerPaymentId,
          providerOrderId: providerResponse.providerOrderId,
        },
      });

      // Update transaction as success
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          transactionStatus: 'SUCCESS',
          providerTransactionReference: providerResponse.providerSessionId,
          responsePayloadJson: providerResponse as any,
          processedAt: new Date(),
        },
      });

      // Write status history if status changed
      if (payment.paymentStatus !== PaymentStatus.PENDING) {
        await this.prisma.paymentStatusHistory.create({
          data: {
            paymentId: id,
            oldStatus: payment.paymentStatus,
            newStatus: PaymentStatus.PENDING,
            changeReason: 'Payment initialized with provider',
            changedBySystem: true,
          },
        });
      }

      this.logger.log(`Payment initialized: ${id} with provider ${payment.paymentProviderKey}`);

      return {
        paymentId: updatedPayment.id,
        providerSessionId: providerResponse.providerSessionId || null,
        redirectUrl: providerResponse.redirectUrl || null,
        paymentStatus: updatedPayment.paymentStatus,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Update transaction as failed
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          transactionStatus: 'FAILED',
          errorCode: 'PROVIDER_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        },
      });

      this.logger.error(`Payment initialization failed: ${id}`, error);
      throw new BadRequestException('Payment initialization failed', [
        {
          reason: ErrorCodes.PAYMENT_INITIALIZATION_FAILED,
          message: 'Failed to initialize payment with provider',
        },
      ]);
    }
  }

  /**
   * Admin manual status update
   */
  async updateStatus(
    id: string,
    dto: UpdatePaymentStatusDto,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: {
        application: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found' },
      ]);
    }

    const oldStatus = payment.paymentStatus;

    if (oldStatus === dto.status) {
      throw new BadRequestException('Status unchanged', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Payment is already in this status' },
      ]);
    }

    // Validate transition
    if (!this.isValidTransition(oldStatus, dto.status)) {
      throw new BadRequestException('Invalid status transition', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Cannot transition from ${oldStatus} to ${dto.status}`,
        },
      ]);
    }

    const updateData: any = {
      paymentStatus: dto.status,
    };

    // Set timestamp based on status
    if (dto.status === PaymentStatus.PAID) {
      updateData.paidAt = new Date();
    } else if (dto.status === PaymentStatus.FAILED) {
      updateData.failedAt = new Date();
    } else if (dto.status === PaymentStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    const updatedPayment = await this.prisma.$transaction(async prisma => {
      const updated = await prisma.payment.update({
        where: { id },
        data: updateData,
        include: {
          application: {
            select: {
              id: true,
              portalIdentityId: true,
              currentStatus: true,
              paymentStatus: true,
              totalFeeAmount: true,
              currencyCode: true,
              // M11.3 — admin Transactions page renders the buyer
              // email. Including the portal identity here keeps the
              // list/detail responses self-sufficient (no per-row
              // hydration round-trips on the frontend).
              portalIdentity: { select: { id: true, email: true } },
            },
          },
        },
      });

      // Create status history
      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: id,
          oldStatus,
          newStatus: dto.status,
          changeReason: dto.note || `Manual status update by admin`,
          changedByUserId: userId,
          changedBySystem: false,
        },
      });

      // Create transaction record for manual update
      await prisma.paymentTransaction.create({
        data: {
          paymentId: id,
          transactionType: 'STATUS_UPDATE',
          transactionStatus: 'SUCCESS',
          internalTransactionReference: this.generateTransactionReference(),
          requestPayloadJson: {
            oldStatus,
            newStatus: dto.status,
            note: dto.note,
            updatedBy: userId,
          },
          processedAt: new Date(),
        },
      });

      // Update application status if payment is paid
      if (dto.status === PaymentStatus.PAID) {
        await this.updateApplicationAfterPayment(
          prisma,
          payment.applicationId,
          PaymentStatus.PAID,
        );
      }

      return updated;
    });

    this.logger.log(
      `Payment status updated: ${id} from ${oldStatus} to ${dto.status} by admin ${userId}`,
    );

    // Audit log for manual status update — lowercase.dot key per Modul 6a
    // convention (was UPPERCASE_SNAKE before Permission Hardening Pack).
    await this.auditLogsService.logAdminAction(
      userId,
      'payment.status.change',
      'Payment',
      id,
      { paymentStatus: oldStatus },
      { paymentStatus: dto.status, note: dto.note },
    );

    return this.mapToResponse(updatedPayment);
  }

  /**
   * Internal method to update payment status (used by system/callbacks)
   */
  /**
   * M11.13 (BUG S) — Confirm a mock-provider payment.
   *
   * Until the real Payriff integration ships, every payment is
   * processed by the mock provider; before this endpoint existed,
   * the customer-side payment page called `initialize` then `submit`
   * but NEVER flipped the payment row to PAID. Admins saw the
   * application as SUBMITTED but the underlying payment was still
   * CREATED/PENDING — Anar's hard-test symptom.
   *
   * This endpoint:
   *   1. Enforces ownership (portal identity owns the application)
   *   2. Enforces provider is mockProvider (real providers must
   *      go through the proper callback path; this is dev-only)
   *   3. Enforces the session isn't expired
   *   4. Flips payment.paymentStatus → PAID via the existing
   *      `updatePaymentStatusInternal` helper, which also:
   *        - writes PaymentStatusHistory
   *        - cascades to application.paymentStatus = PAID
   *        - fires payment.received Telegram emit (post-commit)
   *        - sends payment.success customer email
   */
  async confirmMockPayment(
    paymentId: string,
    portalIdentityId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: {
        application: { select: { portalIdentityId: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment does not exist' },
      ]);
    }
    if (payment.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not own this application' },
      ]);
    }
    if (payment.paymentProviderKey !== 'mockProvider') {
      throw new BadRequestException('Only mock provider payments can be confirmed via this endpoint', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Payment provider is ${payment.paymentProviderKey}; mock confirmation only applies to mockProvider.`,
        },
      ]);
    }
    if (payment.paymentStatus === PaymentStatus.PAID) {
      // Idempotent — return the existing row so the customer-side
      // retry path (network blip + re-click) doesn't error out.
      return this.findByIdForPortal(paymentId, portalIdentityId);
    }
    if (
      payment.paymentStatus !== PaymentStatus.CREATED &&
      payment.paymentStatus !== PaymentStatus.PENDING &&
      payment.paymentStatus !== PaymentStatus.PROCESSING
    ) {
      throw new BadRequestException('Payment cannot be confirmed', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Payment in ${payment.paymentStatus} status cannot be confirmed.`,
        },
      ]);
    }
    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.updatePaymentStatusInternal(
        paymentId,
        PaymentStatus.EXPIRED,
        'Mock confirmation attempted on expired payment',
        true,
      );
      throw new BadRequestException('Payment session expired', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Your payment session has expired. Contact support to issue a new payment link.',
        },
      ]);
    }

    await this.updatePaymentStatusInternal(
      paymentId,
      PaymentStatus.PAID,
      'Mock payment confirmed by customer',
      false,
      undefined,
    );

    this.logger.log(`[BUG S] Mock payment confirmed: ${paymentId} (application=${payment.applicationId})`);

    return this.findByIdForPortal(paymentId, portalIdentityId);
  }

  // ════════════════════════════════════════════════════════════════════
  // Payment Stage 2 — authorize / capture / release / selective refund
  //
  // Builds the MECHANISM only. The customer pay path still produces PAID
  // (confirmMockPayment above). Capture/release/refund are admin/service
  // actions here; Stage 3 wires their TRIGGERS into the two-stage review
  // and flips the customer pay to AUTHORIZED. Each action records a
  // PaymentTransaction (correct TransactionType) + a PaymentStatusHistory
  // row, atomically, mirroring updateStatus.
  // ════════════════════════════════════════════════════════════════════

  /**
   * Shared atomic recorder: update payment status (+extra timestamp
   * columns), write a status-history row + a transaction row, and
   * optionally cascade the application PAID flip. Validates the
   * transition first.
   */
  private async recordPaymentAction(opts: {
    paymentId: string;
    applicationId: string;
    newStatus: PaymentStatus;
    extraData?: Record<string, any>;
    transactionType: string;
    reason: string;
    userId?: string;
    bySystem: boolean;
    txnPayload?: Record<string, any>;
    /**
     * Stage 3 — cascade the application update (UNPAID→SUBMITTED +
     * paymentStatus sync). Was `flipApplicationOnPaid` and fired only on
     * PAID; the customer now pre-authorizes, so AUTHORIZED must flip the
     * application too or every submission stalls in UNPAID (and the
     * payment-window sweep would expire it while funds are held).
     */
    flipApplication?: boolean;
  }): Promise<void> {
    await this.prisma.$transaction(async prisma => {
      const current = await prisma.payment.findUnique({ where: { id: opts.paymentId } });
      if (!current) return;
      const oldStatus = current.paymentStatus;

      await prisma.payment.update({
        where: { id: opts.paymentId },
        data: { paymentStatus: opts.newStatus, ...(opts.extraData ?? {}) },
      });

      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: opts.paymentId,
          oldStatus,
          newStatus: opts.newStatus,
          changeReason: opts.reason,
          changedByUserId: opts.userId,
          changedBySystem: opts.bySystem,
        },
      });

      await prisma.paymentTransaction.create({
        data: {
          paymentId: opts.paymentId,
          transactionType: opts.transactionType as any,
          transactionStatus: 'SUCCESS',
          internalTransactionReference: this.generateTransactionReference(),
          requestPayloadJson: opts.txnPayload ?? {},
          processedAt: new Date(),
        },
      });

      if (
        opts.flipApplication &&
        (opts.newStatus === PaymentStatus.AUTHORIZED || opts.newStatus === PaymentStatus.PAID)
      ) {
        await this.updateApplicationAfterPayment(prisma, opts.applicationId, opts.newStatus);
      }
    });

    this.logger.log(
      `[Stage2] Payment ${opts.paymentId} → ${opts.newStatus} (${opts.transactionType})`,
    );
  }

  /**
   * Dev hook (portal) — mock-authorize a payment (hold funds), analogous
   * to confirmMockPayment but setting AUTHORIZED instead of PAID. Stage 3
   * will route the customer pay through here; today it exists for the
   * mechanism + verification. Does NOT capture / flip the application.
   */
  async confirmMockAuthorize(
    paymentId: string,
    portalIdentityId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: { application: { select: { portalIdentityId: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment does not exist' },
      ]);
    }
    if (payment.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not own this application' },
      ]);
    }
    if (payment.paymentProviderKey !== 'mockProvider') {
      throw new BadRequestException('Only mock provider payments can be authorized via this endpoint', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Provider is ${payment.paymentProviderKey}.` },
      ]);
    }
    if (payment.paymentStatus === PaymentStatus.AUTHORIZED) {
      return this.findByIdForPortal(paymentId, portalIdentityId);
    }
    if (
      payment.paymentStatus !== PaymentStatus.CREATED &&
      payment.paymentStatus !== PaymentStatus.PENDING &&
      payment.paymentStatus !== PaymentStatus.PROCESSING
    ) {
      throw new BadRequestException('Payment cannot be authorized', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Payment in ${payment.paymentStatus} status cannot be authorized.` },
      ]);
    }
    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.updatePaymentStatusInternal(paymentId, PaymentStatus.EXPIRED, 'Authorize attempted on expired payment', true);
      throw new BadRequestException('Payment session expired', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Your payment session has expired.' },
      ]);
    }

    const provider = this.getProvider(payment.paymentProviderKey);
    const res = await provider.authorize({
      paymentId,
      providerPaymentId: payment.providerPaymentId ?? undefined,
      amount: Number(payment.totalAmount),
      currency: payment.currencyCode,
    });
    if (!res.success) {
      throw new BadRequestException('Authorization failed', [
        { reason: ErrorCodes.BAD_REQUEST, message: res.errorMessage || 'Provider declined the authorization.' },
      ]);
    }

    await this.recordPaymentAction({
      paymentId,
      applicationId: payment.applicationId,
      newStatus: PaymentStatus.AUTHORIZED,
      extraData: { authorizedAt: new Date() },
      transactionType: 'AUTHORIZATION',
      reason: 'Mock payment authorized (funds held)',
      bySystem: false,
      txnPayload: { providerReference: res.providerReference },
      // Stage 3 — authorization is the moment the application becomes
      // SUBMITTED (funds held, operator queue). Capture happens later at
      // Accept and finds the application already out of UNPAID.
      flipApplication: true,
    });

    // Post-commit, best-effort: this is the customer-visible "payment
    // received" moment, so the confirmation email + the Telegram ping
    // live here now. They deliberately do NOT fire again on capture —
    // capture goes through recordPaymentAction, which sends nothing.
    void this.notificationEmitter.emit('payment.received', {
      paymentId,
      applicationId: payment.applicationId,
      paymentReference: payment.paymentReference,
      amount: payment.totalAmount?.toString?.(),
      currency: payment.currencyCode,
      provider: payment.paymentProviderKey,
    });
    void this.sendPaymentSuccessEmail(paymentId);

    return this.findByIdForPortal(paymentId, portalIdentityId);
  }

  /**
   * Capture an authorized payment (settlement) → PAID + capturedAt, and
   * cascade the application PAID flip (reusing updateApplicationAfterPayment).
   */
  async capturePayment(paymentId: string, userId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, deletedAt: null } });
    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment does not exist' },
      ]);
    }
    if (payment.paymentStatus !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException('Payment cannot be captured', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Only an AUTHORIZED payment can be captured (current: ${payment.paymentStatus}).` },
      ]);
    }
    const provider = this.getProvider(payment.paymentProviderKey);
    const res = await provider.capture({
      paymentId,
      providerPaymentId: payment.providerPaymentId ?? undefined,
      amount: Number(payment.totalAmount),
      currency: payment.currencyCode,
    });
    if (!res.success) {
      throw new BadRequestException('Capture failed', [
        { reason: ErrorCodes.BAD_REQUEST, message: res.errorMessage || 'Provider declined the capture.' },
      ]);
    }

    await this.recordPaymentAction({
      paymentId,
      applicationId: payment.applicationId,
      newStatus: PaymentStatus.PAID,
      extraData: { paidAt: new Date(), capturedAt: new Date() },
      transactionType: 'CAPTURE',
      reason: 'Payment captured',
      userId,
      bySystem: false,
      txnPayload: { providerReference: res.providerReference },
      flipApplication: true,
    });

    return this.findById(paymentId);
  }

  /**
   * Release/void an authorization → CANCELLED (no charge). No application
   * flip (nothing was captured).
   */
  async releasePayment(paymentId: string, userId: string, reason?: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, deletedAt: null } });
    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment does not exist' },
      ]);
    }
    if (payment.paymentStatus !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException('Payment cannot be released', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Only an AUTHORIZED payment can be released (current: ${payment.paymentStatus}).` },
      ]);
    }
    const provider = this.getProvider(payment.paymentProviderKey);
    const res = await provider.release({
      paymentId,
      providerPaymentId: payment.providerPaymentId ?? undefined,
    });
    if (!res.success) {
      throw new BadRequestException('Release failed', [
        { reason: ErrorCodes.BAD_REQUEST, message: res.errorMessage || 'Provider declined the release.' },
      ]);
    }

    await this.recordPaymentAction({
      paymentId,
      applicationId: payment.applicationId,
      newStatus: PaymentStatus.CANCELLED,
      extraData: { cancelledAt: new Date() },
      transactionType: 'VOID',
      reason: reason || 'Authorization released (no charge)',
      userId,
      bySystem: false,
      txnPayload: { providerReference: res.providerReference, reason },
    });

    return this.findById(paymentId);
  }

  // ════════════════════════════════════════════════════════════════════
  // Stage 3 — first-decision helpers (Accept / Cancel)
  //
  // Accept and Cancel must change the payment AND the application in ONE
  // transaction. `recordPaymentAction` opens its own transaction, so the
  // work is split here: the provider call (an external side effect that
  // cannot be rolled back) runs first, then the caller does every DB
  // write inside its own tx via the record*WithinTx helpers below.
  // ════════════════════════════════════════════════════════════════════

  /**
   * Load the application's live AUTHORIZED payment. Throws when there
   * isn't one — this is the "has the customer actually paid?" gate for
   * both first-decision actions.
   */
  async getAuthorizedPaymentForApplication(applicationId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        applicationId,
        deletedAt: null,
        paymentStatus: PaymentStatus.AUTHORIZED,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new BadRequestException('No authorized payment for this application', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'This application has no payment with funds held (AUTHORIZED), so it cannot be accepted or cancelled.',
        },
      ]);
    }
    return payment;
  }

  /** External provider capture. No DB writes. Returns the provider ref. */
  async runProviderCapture(payment: {
    id: string;
    paymentProviderKey: string;
    providerPaymentId?: string | null;
    totalAmount: any;
    currencyCode: string;
  }): Promise<string | undefined> {
    const provider = this.getProvider(payment.paymentProviderKey);
    const res = await provider.capture({
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId ?? undefined,
      amount: Number(payment.totalAmount),
      currency: payment.currencyCode,
    });
    if (!res.success) {
      throw new BadRequestException('Capture failed', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: res.errorMessage || 'Provider declined the capture.',
        },
      ]);
    }
    return res.providerReference;
  }

  /** External provider release/void. No DB writes. Returns the ref. */
  async runProviderRelease(payment: {
    id: string;
    paymentProviderKey: string;
    providerPaymentId?: string | null;
  }): Promise<string | undefined> {
    const provider = this.getProvider(payment.paymentProviderKey);
    const res = await provider.release({
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId ?? undefined,
    });
    if (!res.success) {
      throw new BadRequestException('Release failed', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: res.errorMessage || 'Provider declined the release.',
        },
      ]);
    }
    return res.providerReference;
  }

  /**
   * Capture DB writes inside the CALLER's transaction: payment → PAID
   * (+paidAt/capturedAt), status history, CAPTURE transaction. The
   * application update is the caller's job in the same tx, which is why
   * this deliberately does NOT call updateApplicationAfterPayment — that
   * would risk a second status-history row.
   */
  async recordCaptureWithinTx(
    tx: any,
    payment: { id: string; paymentStatus: PaymentStatus },
    userId: string,
    providerReference?: string,
  ): Promise<void> {
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { paymentStatus: PaymentStatus.PAID, paidAt: now, capturedAt: now },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: payment.paymentStatus,
        newStatus: PaymentStatus.PAID,
        changeReason: 'Payment captured (operator accepted the application)',
        changedByUserId: userId,
        changedBySystem: false,
      },
    });
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        transactionType: 'CAPTURE' as any,
        transactionStatus: 'SUCCESS',
        internalTransactionReference: this.generateTransactionReference(),
        requestPayloadJson: { providerReference },
        processedAt: now,
      },
    });
  }

  /**
   * Release DB writes inside the CALLER's transaction: payment →
   * CANCELLED (+cancelledAt), status history, VOID transaction. Nothing
   * is charged.
   */
  async recordReleaseWithinTx(
    tx: any,
    payment: { id: string; paymentStatus: PaymentStatus },
    userId: string,
    reason: string,
    providerReference?: string,
  ): Promise<void> {
    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { paymentStatus: PaymentStatus.CANCELLED, cancelledAt: now },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: payment.paymentStatus,
        newStatus: PaymentStatus.CANCELLED,
        changeReason: `Authorization released (no charge): ${reason}`,
        changedByUserId: userId,
        changedBySystem: false,
      },
    });
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        transactionType: 'VOID' as any,
        transactionStatus: 'SUCCESS',
        internalTransactionReference: this.generateTransactionReference(),
        requestPayloadJson: { providerReference, reason },
        processedAt: now,
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // Stage 3 Step 4 — second-decision refund helpers.
  //
  // Same split as capture/release: the caller validates, runs the
  // provider refund OUTSIDE its transaction, then records every DB write
  // INSIDE it. `selectiveRefund` below stays as the standalone admin
  // action (it opens its own transaction via recordPaymentAction), so it
  // must NOT be called from inside another transaction.
  // ════════════════════════════════════════════════════════════════════

  /**
   * Load the application's captured payment (PAID or already partially
   * refunded). This is the "was the money actually taken?" gate for the
   * reject-with-refund path.
   */
  async getCapturedPaymentForApplication(applicationId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        applicationId,
        deletedAt: null,
        paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new BadRequestException('No captured payment for this application', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'This application has no captured (PAID) payment, so there is nothing to refund.',
        },
      ]);
    }
    return payment;
  }

  /**
   * Reject a double refund of the same portion. Kept separate from the
   * provider call so the caller can validate before anything external
   * happens.
   */
  assertRefundablePortions(
    payment: { governmentFeeRefundedAt?: Date | null; serviceFeeRefundedAt?: Date | null },
    portions: { government?: boolean; service?: boolean },
  ): void {
    if (portions.government && payment.governmentFeeRefundedAt) {
      throw new BadRequestException('Government portion already refunded', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'The government fee has already been refunded.',
        },
      ]);
    }
    if (portions.service && payment.serviceFeeRefundedAt) {
      throw new BadRequestException('Service portion already refunded', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'The service fee has already been refunded.' },
      ]);
    }
  }

  /** External provider refund per selected portion. No DB writes. */
  async runProviderRefund(
    payment: {
      id: string;
      paymentProviderKey: string;
      governmentFeeAmount: any;
      serviceFeeAmount: any;
      currencyCode: string;
    },
    portions: { government?: boolean; service?: boolean },
  ): Promise<void> {
    const provider = this.getProvider(payment.paymentProviderKey);
    if (portions.government) {
      const r = await provider.refund({
        paymentId: payment.id,
        amount: Number(payment.governmentFeeAmount),
        currency: payment.currencyCode,
      });
      if (!r.success) {
        throw new BadRequestException('Government refund failed', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: r.errorMessage || 'Provider declined the refund.',
          },
        ]);
      }
    }
    if (portions.service) {
      const r = await provider.refund({
        paymentId: payment.id,
        amount: Number(payment.serviceFeeAmount),
        currency: payment.currencyCode,
      });
      if (!r.success) {
        throw new BadRequestException('Service refund failed', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: r.errorMessage || 'Provider declined the refund.',
          },
        ]);
      }
    }
  }

  /**
   * Refund DB writes inside the CALLER's transaction: portion
   * timestamps, payment status (PARTIALLY_REFUNDED or REFUNDED), status
   * history and a REFUND transaction row. Returns the resulting payment
   * status so the caller can sync `application.paymentStatus` in the
   * same transaction.
   */
  async recordRefundWithinTx(
    tx: any,
    payment: {
      id: string;
      paymentStatus: PaymentStatus;
      governmentFeeAmount: any;
      serviceFeeAmount: any;
      governmentFeeRefundedAt?: Date | null;
      serviceFeeRefundedAt?: Date | null;
    },
    portions: { government?: boolean; service?: boolean },
    userId: string,
    reason?: string,
  ): Promise<PaymentStatus> {
    const now = new Date();
    const wantGov = portions.government === true;
    const wantSvc = portions.service === true;

    const govRefunded = !!payment.governmentFeeRefundedAt || wantGov;
    const svcRefunded = !!payment.serviceFeeRefundedAt || wantSvc;
    // government + service are the two split portions; both refunded →
    // fully REFUNDED, otherwise PARTIALLY_REFUNDED.
    const newStatus =
      govRefunded && svcRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

    const data: Record<string, any> = { paymentStatus: newStatus };
    if (wantGov) data.governmentFeeRefundedAt = now;
    if (wantSvc) data.serviceFeeRefundedAt = now;

    await tx.payment.update({ where: { id: payment.id }, data });

    const label = [wantGov && 'government', wantSvc && 'service'].filter(Boolean).join(', ');
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: payment.paymentStatus,
        newStatus,
        changeReason: reason
          ? `Selective refund (${label}): ${reason}`
          : `Selective refund (${label})`,
        changedByUserId: userId,
        changedBySystem: false,
      },
    });

    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        transactionType: 'REFUND' as any,
        transactionStatus: 'SUCCESS',
        internalTransactionReference: this.generateTransactionReference(),
        requestPayloadJson: {
          portions: { government: wantGov, service: wantSvc },
          governmentAmount: wantGov ? Number(payment.governmentFeeAmount) : undefined,
          serviceAmount: wantSvc ? Number(payment.serviceFeeAmount) : undefined,
          reason,
        },
        processedAt: now,
      },
    });

    return newStatus;
  }

  /**
   * Selective refund — refund the government and/or service fee portion(s)
   * in FULL (no arbitrary partial amounts). Valid only from a captured
   * payment (PAID or PARTIALLY_REFUNDED). Stamps the per-portion marker;
   * status becomes REFUNDED once both split portions are refunded, else
   * PARTIALLY_REFUNDED. Expedited fee is not separately refundable here.
   *
   * Standalone admin action — opens its own transaction. The reject flow
   * uses the tx-aware helpers above instead.
   */
  async selectiveRefund(
    paymentId: string,
    portions: { government?: boolean; service?: boolean },
    userId: string,
    reason?: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, deletedAt: null } });
    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment does not exist' },
      ]);
    }
    if (
      payment.paymentStatus !== PaymentStatus.PAID &&
      payment.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException('Payment cannot be refunded', [
        { reason: ErrorCodes.BAD_REQUEST, message: `Only a captured (PAID) payment can be refunded (current: ${payment.paymentStatus}).` },
      ]);
    }
    const wantGov = portions.government === true;
    const wantSvc = portions.service === true;
    if (!wantGov && !wantSvc) {
      throw new BadRequestException('No portion selected', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Select at least one fee portion to refund (government and/or service).' },
      ]);
    }
    if (wantGov && payment.governmentFeeRefundedAt) {
      throw new BadRequestException('Government portion already refunded', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'The government fee has already been refunded.' },
      ]);
    }
    if (wantSvc && payment.serviceFeeRefundedAt) {
      throw new BadRequestException('Service portion already refunded', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'The service fee has already been refunded.' },
      ]);
    }

    const provider = this.getProvider(payment.paymentProviderKey);
    if (wantGov) {
      const r = await provider.refund({ paymentId, amount: Number(payment.governmentFeeAmount), currency: payment.currencyCode });
      if (!r.success) throw new BadRequestException('Government refund failed', [{ reason: ErrorCodes.BAD_REQUEST, message: r.errorMessage || 'Provider declined the refund.' }]);
    }
    if (wantSvc) {
      const r = await provider.refund({ paymentId, amount: Number(payment.serviceFeeAmount), currency: payment.currencyCode });
      if (!r.success) throw new BadRequestException('Service refund failed', [{ reason: ErrorCodes.BAD_REQUEST, message: r.errorMessage || 'Provider declined the refund.' }]);
    }

    const now = new Date();
    const govRefunded = !!payment.governmentFeeRefundedAt || wantGov;
    const svcRefunded = !!payment.serviceFeeRefundedAt || wantSvc;
    // gov + service are the two split portions; both refunded → fully REFUNDED.
    const newStatus = govRefunded && svcRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

    const extraData: Record<string, any> = {};
    if (wantGov) extraData.governmentFeeRefundedAt = now;
    if (wantSvc) extraData.serviceFeeRefundedAt = now;

    await this.recordPaymentAction({
      paymentId,
      applicationId: payment.applicationId,
      newStatus,
      extraData,
      transactionType: 'REFUND',
      reason: reason || `Selective refund (${[wantGov && 'government', wantSvc && 'service'].filter(Boolean).join(', ')})`,
      userId,
      bySystem: false,
      txnPayload: {
        portions: { government: wantGov, service: wantSvc },
        governmentAmount: wantGov ? Number(payment.governmentFeeAmount) : undefined,
        serviceAmount: wantSvc ? Number(payment.serviceFeeAmount) : undefined,
        reason,
      },
    });

    return this.findById(paymentId);
  }

  private async updatePaymentStatusInternal(
    paymentId: string,
    newStatus: PaymentStatus,
    reason: string,
    bySystem: boolean,
    userId?: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) return;

    const oldStatus = payment.paymentStatus;
    if (oldStatus === newStatus) return;

    const updateData: any = {
      paymentStatus: newStatus,
    };

    if (newStatus === PaymentStatus.PAID) {
      updateData.paidAt = new Date();
      // Payment Stage 2 — a PAID transition is a capture; stamp it once.
      if (!payment.capturedAt) updateData.capturedAt = new Date();
    } else if (newStatus === PaymentStatus.AUTHORIZED) {
      updateData.authorizedAt = new Date();
    } else if (newStatus === PaymentStatus.FAILED) {
      updateData.failedAt = new Date();
    } else if (newStatus === PaymentStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    await this.prisma.$transaction(async prisma => {
      await prisma.payment.update({
        where: { id: paymentId },
        data: updateData,
      });

      await prisma.paymentStatusHistory.create({
        data: {
          paymentId,
          oldStatus,
          newStatus,
          changeReason: reason,
          changedByUserId: userId,
          changedBySystem: bySystem,
        },
      });

      if (newStatus === PaymentStatus.PAID) {
        await this.updateApplicationAfterPayment(
          prisma,
          payment.applicationId,
          PaymentStatus.PAID,
        );
      }
    });

    this.logger.log(`Payment ${paymentId} status updated: ${oldStatus} -> ${newStatus}`);

    // M11.5 — Telegram notifications. Fired AFTER the transaction
    // commits so a delivery failure can't roll back a real payment.
    if (newStatus === PaymentStatus.FAILED) {
      void this.notificationEmitter.emit('payment.failed', {
        paymentId,
        applicationId: payment.applicationId,
        paymentReference: payment.paymentReference,
        amount: payment.totalAmount?.toString?.(),
        currency: payment.currencyCode,
        reason,
      });
    }
  }

  /**
   * M11.10 (BUG 3) — Send the customer payment confirmation email.
   *
   * Variables wired into the `payment.success` template (M11.8 EXT):
   *   fullName, applicationCode, applicationStatus,
   *   destinationCountry, visaType, ctaUrl
   *
   * Plus M11.10 (BUG 6) breakdown variables for the email body:
   *   amount, currency, governmentFee, serviceFee, expeditedFee
   *
   * Emits one `notification.email_sent` audit row per recipient
   * (portal email + every applicant email, deduped). Mirrors the
   * pattern in applications.service.sendStatusNotificationEmail so
   * post-payment + post-status emails behave identically.
   */
  private async sendPaymentSuccessEmail(paymentId: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: { id: paymentId, deletedAt: null },
        include: {
          application: {
            include: {
              portalIdentity: true,
              destinationCountry: { select: { name: true } },
              visaType: { select: { label: true } },
              applicants: {
                where: { deletedAt: null },
                orderBy: { isMainApplicant: 'desc' },
              },
            },
          },
        },
      });
      if (!payment?.application) return;

      const app = payment.application;
      const main = app.applicants?.find((a: any) => a.isMainApplicant) ?? app.applicants?.[0];
      const applicationCode = main?.applicationCode;
      if (!applicationCode) {
        this.logger.warn(`No applicationCode for payment ${paymentId}; skipping email`);
        return;
      }

      const fullName = (() => {
        const data = (main?.formDataJson ?? {}) as Record<string, unknown>;
        const fn = String(data.firstName ?? '').trim();
        const ln = String(data.lastName ?? '').trim();
        return [fn, ln].filter(Boolean).join(' ') || 'Applicant';
      })();

      const baseUrl = (
        this.configService.get<string>('FRONTEND_URL') ??
        this.configService.get<string>('PUBLIC_BASE_URL') ??
        'https://evisaglobal.com'
      ).replace(/\/+$/, '');

      // Recipient set: portal email + every applicant.email
      // (case-insensitive dedup so co-applicants on the same address
      // don't get double-mailed).
      const recipients = new Set<string>();
      if (app.portalIdentity?.email) {
        recipients.add(app.portalIdentity.email.toLowerCase().trim());
      }
      for (const ap of app.applicants ?? []) {
        if (ap.email) recipients.add(ap.email.toLowerCase().trim());
      }
      if (recipients.size === 0) return;

      const variables = {
        fullName,
        applicationCode,
        applicationStatus: 'Payment received',
        destinationCountry: app.destinationCountry?.name ?? '',
        visaType: app.visaType?.label ?? '',
        ctaUrl: `${baseUrl}/track`,
        // BUG 6 breakdown
        amount: payment.totalAmount?.toString() ?? '',
        currency: payment.currencyCode ?? '',
        governmentFee: payment.governmentFeeAmount?.toString() ?? '',
        serviceFee: payment.serviceFeeAmount?.toString() ?? '',
        expeditedFee: payment.expeditedFeeAmount?.toString() ?? '',
        paymentReference: payment.paymentReference ?? '',
      };

      for (const recipient of recipients) {
        try {
          const result = await this.emailService.sendTemplatedEmail({
            to: recipient,
            templateKey: 'payment.success',
            variables,
            relatedEntity: 'Payment',
            relatedEntityId: payment.id,
          });
          await this.auditLogsService.logSystemAction(
            'notification.email_sent',
            'Payment',
            payment.id,
            undefined,
            {
              recipient,
              templateKey: 'payment.success',
              applicationCode,
              success: result.success,
              messageId: result.messageId ?? null,
              error: result.error ?? null,
            },
          );
          this.logger.log(
            `[BUG 3] payment.success → ${recipient} (${applicationCode}) ${result.success ? 'ok' : 'fail'}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed payment.success email to ${recipient}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `sendPaymentSuccessEmail outer error for ${paymentId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Update the application after a successful payment step.
   *
   * Stage 3 — `paymentStatus` is now a PARAMETER, not a hardcoded PAID.
   * The customer pre-authorizes (AUTHORIZED) and the operator captures at
   * Accept (PAID); recording a false PAID at authorize time would tell the
   * admin panel funds were settled when they are only held.
   *
   * The UNPAID→SUBMITTED move fires on either status — that is what takes
   * the application out of the payment-window sweep's reach.
   */
  private async updateApplicationAfterPayment(
    prisma: any,
    applicationId: string,
    paymentStatus: PaymentStatus = PaymentStatus.PAID,
  ): Promise<void> {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) return;

    // Update application payment status and move to SUBMITTED if in UNPAID
    const updateData: any = {
      paymentStatus,
    };

    // If application is in UNPAID status, move to SUBMITTED.
    // NOTE: the Application model has no `submittedAt` column (the
    // submission moment lives in application_status_history below), so
    // writing it here threw "Unknown argument submittedAt" and 500'd the
    // whole PAID flip. This was latent until the payments[] fix let the
    // confirm step actually reach this code.
    if (application.currentStatus === ApplicationStatus.UNPAID) {
      updateData.currentStatus = ApplicationStatus.SUBMITTED;
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Create application status history if status changed. Only the
    // UNPAID→SUBMITTED transition writes a row, so a later capture (the
    // application is already SUBMITTED by then) cannot duplicate it.
    if (application.currentStatus === ApplicationStatus.UNPAID) {
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          oldStatus: ApplicationStatus.UNPAID,
          newStatus: ApplicationStatus.SUBMITTED,
          note:
            paymentStatus === PaymentStatus.AUTHORIZED
              ? 'Payment authorized (funds held), application submitted'
              : 'Payment completed, application submitted',
          changedBySystem: true,
        },
      });
    }

    this.logger.log(
      `Application ${applicationId} updated after payment (${paymentStatus})`,
    );
  }

  /**
   * Status transition validation
   *
   * Valid transitions:
   * - CREATED -> PENDING, EXPIRED, CANCELLED
   * - PENDING -> PROCESSING, PAID, FAILED, EXPIRED, CANCELLED
   * - PROCESSING -> PAID, FAILED
   * - PAID -> REFUNDED, PARTIALLY_REFUNDED
   * - FAILED -> PENDING (retry)
   * - EXPIRED -> (terminal)
   * - CANCELLED -> (terminal)
   * - REFUNDED -> (terminal)
   * - PARTIALLY_REFUNDED -> REFUNDED
   */
  private isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    const transitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.CREATED]: [
        PaymentStatus.PENDING,
        // Payment Stage 2 — authorize (hold) directly from CREATED.
        PaymentStatus.AUTHORIZED,
        PaymentStatus.EXPIRED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.PENDING]: [
        PaymentStatus.PROCESSING,
        // Payment Stage 2 — authorize (hold) from PENDING.
        PaymentStatus.AUTHORIZED,
        PaymentStatus.PAID,
        PaymentStatus.FAILED,
        PaymentStatus.EXPIRED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.PROCESSING]: [PaymentStatus.PAID, PaymentStatus.FAILED],
      // Payment Stage 2 — capture → PAID, release → CANCELLED, or expire.
      [PaymentStatus.AUTHORIZED]: [
        PaymentStatus.PAID,
        PaymentStatus.CANCELLED,
        PaymentStatus.EXPIRED,
      ],
      [PaymentStatus.PAID]: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
      [PaymentStatus.FAILED]: [PaymentStatus.PENDING],
      [PaymentStatus.EXPIRED]: [],
      [PaymentStatus.CANCELLED]: [],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  async getTransactions(id: string): Promise<PaymentTransactionDto[]> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { paymentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map(txn => ({
      id: txn.id,
      transactionType: txn.transactionType,
      transactionStatus: txn.transactionStatus,
      internalTransactionReference: txn.internalTransactionReference,
      providerTransactionReference: txn.providerTransactionReference || undefined,
      providerEventKey: txn.providerEventKey || undefined,
      errorCode: txn.errorCode || undefined,
      errorMessage: txn.errorMessage || undefined,
      processedAt: txn.processedAt || undefined,
      createdAt: txn.createdAt,
    }));
  }

  async getCallbacks(id: string): Promise<PaymentCallbackDto[]> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const callbacks = await this.prisma.paymentCallback.findMany({
      where: { paymentId: id },
      orderBy: { receivedAt: 'desc' },
    });

    return callbacks.map(cb => ({
      id: cb.id,
      providerKey: cb.providerKey,
      callbackType: cb.callbackType,
      providerEventId: cb.providerEventId || undefined,
      signatureValidationStatus: cb.signatureValidationStatus,
      processingStatus: cb.processingStatus,
      errorMessage: cb.errorMessage || undefined,
      receivedAt: cb.receivedAt,
      processedAt: cb.processedAt || undefined,
    }));
  }

  /**
   * Handle payment callback from provider
   *
   * Behavior:
   * 1. Store raw callback data
   * 2. Validate callback with provider
   * 3. Match to payment if possible
   * 4. Update payment status if applicable
   * 5. Create transaction record
   */
  async handleCallback(
    providerKey: string,
    headers: Record<string, string>,
    payload: any,
  ): Promise<{ received: boolean; callbackId: string }> {
    this.logger.log(`Received callback from provider: ${providerKey}`);

    // Try to find provider
    const provider = this.providers.get(providerKey);

    // Try to match payment by reference
    const paymentReference = payload.paymentReference || payload.payment_reference || payload.ref;
    const providerPaymentId =
      payload.providerPaymentId || payload.provider_payment_id || payload.payment_id;

    let payment = null;
    if (paymentReference) {
      payment = await this.prisma.payment.findFirst({
        where: {
          paymentReference,
          deletedAt: null,
        },
      });
    } else if (providerPaymentId) {
      payment = await this.prisma.payment.findFirst({
        where: {
          providerPaymentId,
          deletedAt: null,
        },
      });
    }

    // Create callback record
    const callback = await this.prisma.paymentCallback.create({
      data: {
        paymentId: payment?.id || '',
        providerKey,
        callbackType: payload.type || payload.event_type || 'unknown',
        providerEventId: payload.id || payload.event_id,
        headersJson: headers,
        payloadJson: payload,
        signatureValidationStatus: provider ? 'NOT_CHECKED' : 'NOT_APPLICABLE',
        processingStatus: 'PENDING',
        receivedAt: new Date(),
      },
    });

    this.logger.log(`Callback stored: ${callback.id}`);

    // Process callback if provider and payment found
    if (provider && payment) {
      try {
        const validation = await provider.validateCallback({
          headers,
          payload,
        });

        // Update callback with validation result
        await this.prisma.paymentCallback.update({
          where: { id: callback.id },
          data: {
            signatureValidationStatus: validation.isValid ? 'VALID' : 'INVALID',
            processingStatus: validation.isValid ? 'PROCESSING' : 'FAILED',
            errorMessage: validation.errorMessage,
          },
        });

        if (validation.isValid && validation.status) {
          // Create transaction for callback processing
          const transactionRef = this.generateTransactionReference();

          const transaction = await this.prisma.paymentTransaction.create({
            data: {
              paymentId: payment.id,
              transactionType: 'CALLBACK',
              transactionStatus: 'SUCCESS',
              internalTransactionReference: transactionRef,
              providerEventKey: validation.eventType,
              requestPayloadJson: payload,
              processedAt: new Date(),
            },
          });

          // Update callback with transaction reference
          await this.prisma.paymentCallback.update({
            where: { id: callback.id },
            data: {
              paymentTransactionId: transaction.id,
              processingStatus: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          // Map provider status to internal status
          const statusMap: Record<string, PaymentStatus> = {
            pending: PaymentStatus.PENDING,
            processing: PaymentStatus.PROCESSING,
            paid: PaymentStatus.PAID,
            failed: PaymentStatus.FAILED,
            cancelled: PaymentStatus.CANCELLED,
          };

          const newStatus = statusMap[validation.status];
          if (newStatus && this.isValidTransition(payment.paymentStatus, newStatus)) {
            await this.updatePaymentStatusInternal(
              payment.id,
              newStatus,
              `Callback: ${validation.eventType}`,
              true,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Callback processing failed: ${callback.id}`, error);

        await this.prisma.paymentCallback.update({
          where: { id: callback.id },
          data: {
            processingStatus: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } else {
      // Mark as unmatched if no payment found
      await this.prisma.paymentCallback.update({
        where: { id: callback.id },
        data: {
          processingStatus: payment ? 'PENDING' : 'FAILED',
          errorMessage: payment ? undefined : 'Could not match callback to payment',
        },
      });
    }

    return { received: true, callbackId: callback.id };
  }

  /**
   * Create reconciliation record for a payment
   * Used for provider settlement checks
   */
  async createReconciliation(
    paymentId: string,
    data: {
      providerReportedAmount?: number;
      providerReportedCurrencyCode?: string;
      providerReportedStatus?: string;
      note?: string;
    },
  ): Promise<any> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found' },
      ]);
    }

    // Determine reconciliation status
    let reconciliationStatus: 'PENDING' | 'MATCHED' | 'MISMATCHED' | 'MANUAL_REVIEW' = 'PENDING';
    if (data.providerReportedAmount !== undefined && data.providerReportedCurrencyCode) {
      const internalAmount = Number(payment.payableAmount);
      const providerAmount = data.providerReportedAmount;

      if (
        providerAmount === internalAmount &&
        data.providerReportedCurrencyCode === payment.currencyCode
      ) {
        reconciliationStatus = 'MATCHED';
      } else {
        reconciliationStatus = 'MISMATCHED';
      }
    }

    const reconciliation = await this.prisma.paymentReconciliation.create({
      data: {
        paymentId,
        reconciliationStatus,
        providerReportedAmount: data.providerReportedAmount,
        providerReportedCurrencyCode: data.providerReportedCurrencyCode,
        providerReportedStatus: data.providerReportedStatus,
        checkedAt: new Date(),
        note: data.note,
      },
    });

    this.logger.log(`Reconciliation created: ${reconciliation.id} for payment: ${paymentId}`);
    return reconciliation;
  }

  /**
   * Get reconciliation records for a payment
   */
  async getReconciliations(paymentId: string): Promise<any[]> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Payment not found' },
      ]);
    }

    return this.prisma.paymentReconciliation.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapToResponse(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      paymentReference: payment.paymentReference,
      paymentProviderKey: payment.paymentProviderKey,
      paymentMethodKey: payment.paymentMethodKey || undefined,
      currencyCode: payment.currencyCode,
      governmentFeeAmount: payment.governmentFeeAmount.toString(),
      serviceFeeAmount: payment.serviceFeeAmount.toString(),
      expeditedFeeAmount: payment.expeditedFeeAmount?.toString() || undefined,
      totalAmount: payment.totalAmount.toString(),
      payableAmount: payment.payableAmount.toString(),
      paymentStatus: payment.paymentStatus,
      providerPaymentId: payment.providerPaymentId || undefined,
      providerSessionId: payment.providerSessionId || undefined,
      providerOrderId: payment.providerOrderId || undefined,
      idempotencyKey: payment.idempotencyKey || undefined,
      expiresAt: payment.expiresAt || undefined,
      paidAt: payment.paidAt || undefined,
      failedAt: payment.failedAt || undefined,
      cancelledAt: payment.cancelledAt || undefined,
      application: payment.application
        ? {
            id: payment.application.id,
            // M11.10 BUG 4 + M11.11 BUG J — surface booking REF code +
            // applicants list so the admin Transactions list / detail
            // pages can render the new Reference column + the
            // "Applications under this booking" card without an
            // extra round-trip.
            referenceCode: payment.application.referenceCode ?? null,
            portalIdentityId: payment.application.portalIdentityId,
            currentStatus: payment.application.currentStatus,
            paymentStatus: payment.application.paymentStatus,
            totalFeeAmount: payment.application.totalFeeAmount.toString(),
            currencyCode: payment.application.currencyCode,
            // M11.3 — surface the buyer email so admin Transactions
            // can render it without an extra round-trip. Only present
            // when the include path eager-loaded portalIdentity.
            portalIdentity: payment.application.portalIdentity
              ? {
                  id: payment.application.portalIdentity.id,
                  email: payment.application.portalIdentity.email,
                }
              : undefined,
            applicants: payment.application.applicants?.map((ap: any) => {
              // M11.11 BUG J — derive a display-ready full name from
              // formDataJson server-side so the admin detail page
              // doesn't have to know the form schema. Falls back to
              // any combination of first/last that's present.
              const fd = (ap.formDataJson ?? {}) as Record<string, any>;
              const first =
                fd.firstName || fd.first_name || fd.givenName || fd.given_name;
              const last =
                fd.lastName || fd.last_name || fd.familyName || fd.family_name || fd.surname;
              const fullName =
                fd.fullName ||
                fd.full_name ||
                [first, last].filter(Boolean).join(' ').trim() ||
                null;
              return {
                id: ap.id,
                applicationCode: ap.applicationCode ?? null,
                status: ap.status,
                isMainApplicant: ap.isMainApplicant,
                email: ap.email ?? null,
                phone: ap.phone ?? null,
                fullName,
              };
            }),
          }
        : undefined,
      transactions: payment.transactions?.map((txn: any) => ({
        id: txn.id,
        transactionType: txn.transactionType,
        transactionStatus: txn.transactionStatus,
        internalTransactionReference: txn.internalTransactionReference,
        providerTransactionReference: txn.providerTransactionReference || undefined,
        providerEventKey: txn.providerEventKey || undefined,
        errorCode: txn.errorCode || undefined,
        errorMessage: txn.errorMessage || undefined,
        processedAt: txn.processedAt || undefined,
        createdAt: txn.createdAt,
      })),
      callbacks: payment.callbacks?.map((cb: any) => ({
        id: cb.id,
        providerKey: cb.providerKey,
        callbackType: cb.callbackType,
        providerEventId: cb.providerEventId || undefined,
        signatureValidationStatus: cb.signatureValidationStatus,
        processingStatus: cb.processingStatus,
        errorMessage: cb.errorMessage || undefined,
        receivedAt: cb.receivedAt,
        processedAt: cb.processedAt || undefined,
      })),
      statusHistory: payment.statusHistory?.map((sh: any) => ({
        id: sh.id,
        oldStatus: sh.oldStatus,
        newStatus: sh.newStatus,
        changeReason: sh.changeReason || undefined,
        changedByUserId: sh.changedByUserId || undefined,
        changedBySystem: sh.changedBySystem,
        createdAt: sh.createdAt,
      })),
      reconciliation: payment.reconciliation?.[0]
        ? {
            id: payment.reconciliation[0].id,
            reconciliationStatus: payment.reconciliation[0].reconciliationStatus,
            providerReportedAmount: payment.reconciliation[0].providerReportedAmount?.toString(),
            providerReportedCurrencyCode: payment.reconciliation[0].providerReportedCurrencyCode,
            providerReportedStatus: payment.reconciliation[0].providerReportedStatus,
            checkedAt: payment.reconciliation[0].checkedAt,
            note: payment.reconciliation[0].note,
          }
        : undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

/**
 * M11.7 (B1) — RFC 4180-style CSV escape: wrap any cell containing a
 * comma, double-quote, or newline in quotes, and double up any inner
 * double-quotes. Numbers are coerced to string upstream so this only
 * has to deal with strings.
 */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
