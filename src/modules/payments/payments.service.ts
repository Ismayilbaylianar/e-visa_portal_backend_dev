import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentDto,
  InitializePaymentDto,
  UpdatePaymentStatusDto,
  PaymentResponseDto,
  GetPaymentsQueryDto,
  PaymentTransactionDto,
  PaymentCallbackDto,
} from './dto';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';
import { PaymentStatus, ApplicationStatus } from '@/common/enums';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generatePaymentReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `PAY-${timestamp}-${random}`;
  }

  private generateIdempotencyKey(): string {
    return randomBytes(16).toString('hex');
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
              portalIdentityId: true,
              currentStatus: true,
              paymentStatus: true,
              totalFeeAmount: true,
              currencyCode: true,
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

  async findById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
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
        },
        callbacks: {
          orderBy: { receivedAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponse(payment);
  }

  async findByIdForPortal(
    id: string,
    portalIdentityId: string,
  ): Promise<PaymentResponseDto> {
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
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.mapToResponse(payment);
  }

  async create(
    dto: CreatePaymentDto,
    portalIdentityId: string,
  ): Promise<PaymentResponseDto> {
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
      throw new NotFoundException('Application not found');
    }

    if (application.currentStatus !== ApplicationStatus.UNPAID) {
      throw new BadRequestException(
        'Payment can only be created for applications in UNPAID status',
      );
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        applicationId: dto.applicationId,
        paymentStatus: {
          in: [PaymentStatus.PENDING, PaymentStatus.PAID],
        },
        deletedAt: null,
      },
    });

    if (existingPayment) {
      if (existingPayment.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Application already has a completed payment');
      }
      throw new BadRequestException(
        'Application already has a pending payment. Please complete or cancel it first.',
      );
    }

    const nationalityFee = application.templateBinding.nationalityFees.find(
      fee => fee.nationalityCountryId === application.nationalityCountryId,
    );

    if (!nationalityFee) {
      throw new BadRequestException('Fee configuration not found for this nationality');
    }

    const governmentFee = Number(nationalityFee.governmentFeeAmount);
    const serviceFee = Number(nationalityFee.serviceFeeAmount);
    const expeditedFee =
      application.expedited && nationalityFee.expeditedEnabled
        ? Number(nationalityFee.expeditedFeeAmount || 0)
        : 0;

    const totalAmount = governmentFee + serviceFee + expeditedFee;
    const payableAmount = totalAmount;

    const payment = await this.prisma.payment.create({
      data: {
        applicationId: dto.applicationId,
        paymentReference: this.generatePaymentReference(),
        paymentProviderKey: 'default',
        currencyCode: nationalityFee.currencyCode,
        governmentFeeAmount: governmentFee,
        serviceFeeAmount: serviceFee,
        expeditedFeeAmount: expeditedFee > 0 ? expeditedFee : null,
        totalAmount,
        payableAmount,
        paymentStatus: PaymentStatus.PENDING,
        idempotencyKey: this.generateIdempotencyKey(),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
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

    await this.prisma.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.PENDING,
        changeReason: 'Payment created',
        changedBySystem: true,
      },
    });

    this.logger.log(`Payment created: ${payment.id} for application: ${dto.applicationId}`);
    return this.mapToResponse(payment);
  }

  async initialize(
    id: string,
    dto: InitializePaymentDto,
    portalIdentityId: string,
  ): Promise<PaymentResponseDto> {
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
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        'Only pending payments can be initialized',
      );
    }

    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.prisma.payment.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.EXPIRED },
      });
      throw new BadRequestException('Payment has expired');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        paymentMethodKey: dto.paymentMethodKey,
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

    await this.prisma.paymentTransaction.create({
      data: {
        paymentId: id,
        transactionType: 'INITIALIZATION',
        transactionStatus: 'SUCCESS',
        internalTransactionReference: `TXN-${this.generatePaymentReference()}`,
        processedAt: new Date(),
      },
    });

    this.logger.log(`Payment initialized: ${id} with method: ${dto.paymentMethodKey}`);
    return this.mapToResponse(updatedPayment);
  }

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
      throw new NotFoundException('Payment not found');
    }

    const oldStatus = payment.paymentStatus;

    if (oldStatus === dto.status) {
      throw new BadRequestException('Payment is already in this status');
    }

    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [
        PaymentStatus.PAID,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.EXPIRED,
      ],
      [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
      [PaymentStatus.EXPIRED]: [PaymentStatus.PENDING],
      [PaymentStatus.FAILED]: [PaymentStatus.PENDING],
      [PaymentStatus.CANCELLED]: [],
      [PaymentStatus.REFUNDED]: [],
    };

    if (!validTransitions[oldStatus]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${oldStatus} to ${dto.status}`,
      );
    }

    const updateData: any = {
      paymentStatus: dto.status,
    };

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
            },
          },
        },
      });

      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: id,
          oldStatus,
          newStatus: dto.status,
          changeReason: dto.changeReason,
          changedByUserId: userId,
          changedBySystem: false,
        },
      });

      if (dto.status === PaymentStatus.PAID) {
        await prisma.application.update({
          where: { id: payment.applicationId },
          data: { paymentStatus: PaymentStatus.PAID },
        });
      }

      return updated;
    });

    this.logger.log(
      `Payment status updated: ${id} from ${oldStatus} to ${dto.status} by user ${userId}`,
    );
    return this.mapToResponse(updatedPayment);
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

  async handleCallback(
    providerKey: string,
    headers: Record<string, string>,
    payload: any,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received callback from provider: ${providerKey}`);

    const paymentReference = payload.paymentReference || payload.payment_reference;
    
    let payment = null;
    if (paymentReference) {
      payment = await this.prisma.payment.findFirst({
        where: {
          paymentReference,
          deletedAt: null,
        },
      });
    }

    const callback = await this.prisma.paymentCallback.create({
      data: {
        paymentId: payment?.id || '',
        providerKey,
        callbackType: payload.type || payload.event_type || 'unknown',
        providerEventId: payload.id || payload.event_id,
        headersJson: headers,
        payloadJson: payload,
        signatureValidationStatus: 'NOT_CHECKED',
        processingStatus: 'PENDING',
        receivedAt: new Date(),
      },
    });

    this.logger.log(`Callback stored: ${callback.id}`);

    return { received: true };
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
            portalIdentityId: payment.application.portalIdentityId,
            currentStatus: payment.application.currentStatus,
            paymentStatus: payment.application.paymentStatus,
            totalFeeAmount: payment.application.totalFeeAmount.toString(),
            currencyCode: payment.application.currencyCode,
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
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
