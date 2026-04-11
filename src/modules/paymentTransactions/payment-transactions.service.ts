import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentTransactionResponseDto } from './dto';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CreatePaymentTransactionInput {
  paymentId: string;
  transactionType: TransactionType;
  transactionStatus: TransactionStatus;
  providerTransactionReference?: string;
  providerEventKey?: string;
  requestPayloadJson?: any;
  responsePayloadJson?: any;
  errorCode?: string;
  errorMessage?: string;
  processedAt?: Date;
}

@Injectable()
export class PaymentTransactionsService {
  private readonly logger = new Logger(PaymentTransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePaymentTransactionInput): Promise<PaymentTransactionResponseDto> {
    const internalTransactionReference = this.generateTransactionReference();

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        paymentId: input.paymentId,
        transactionType: input.transactionType,
        transactionStatus: input.transactionStatus,
        internalTransactionReference,
        providerTransactionReference: input.providerTransactionReference,
        providerEventKey: input.providerEventKey,
        requestPayloadJson: input.requestPayloadJson,
        responsePayloadJson: input.responsePayloadJson,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        processedAt: input.processedAt,
      },
    });

    this.logger.log(
      `Payment transaction created: ${transaction.id} for payment ${input.paymentId}`,
    );
    return this.mapToResponse(transaction);
  }

  async findByPayment(paymentId: string): Promise<PaymentTransactionResponseDto[]> {
    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map(t => this.mapToResponse(t));
  }

  async findById(id: string): Promise<PaymentTransactionResponseDto | null> {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return null;
    }

    return this.mapToResponse(transaction);
  }

  private generateTransactionReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniquePart = uuidv4().slice(0, 8).toUpperCase();
    return `TXN-${date}-${uniquePart}`;
  }

  private mapToResponse(transaction: any): PaymentTransactionResponseDto {
    return {
      id: transaction.id,
      paymentId: transaction.paymentId,
      transactionType: transaction.transactionType,
      transactionStatus: transaction.transactionStatus,
      internalTransactionReference: transaction.internalTransactionReference,
      providerTransactionReference: transaction.providerTransactionReference || undefined,
      providerEventKey: transaction.providerEventKey || undefined,
      requestPayloadJson: transaction.requestPayloadJson || undefined,
      responsePayloadJson: transaction.responsePayloadJson || undefined,
      errorCode: transaction.errorCode || undefined,
      errorMessage: transaction.errorMessage || undefined,
      processedAt: transaction.processedAt || undefined,
      createdAt: transaction.createdAt,
    };
  }
}
