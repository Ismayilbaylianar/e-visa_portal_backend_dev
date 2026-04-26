import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailLogStatus } from '@prisma/client';

/**
 * Parameters for creating an email log entry
 */
export interface CreateEmailLogParams {
  templateKey: string;
  recipient: string;
  subject?: string;
  provider: string;
  status: EmailLogStatus;
  messageId?: string;
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  relatedEntity?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
}

/**
 * Email Log Service
 *
 * Provides comprehensive logging for all email sending operations.
 * Captures:
 * - Template used
 * - Recipient
 * - Provider used
 * - Send status (success/failure)
 * - Error details
 * - Related entity references (notification, otp, etc.)
 */
@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a pending email send attempt
   */
  async logPending(params: Omit<CreateEmailLogParams, 'status'>): Promise<string> {
    const log = await this.prisma.emailLog.create({
      data: {
        templateKey: params.templateKey,
        recipient: params.recipient,
        subject: params.subject,
        provider: params.provider,
        status: EmailLogStatus.PENDING,
        retryCount: params.retryCount || 0,
        relatedEntity: params.relatedEntity,
        relatedEntityId: params.relatedEntityId,
        metadataJson: params.metadata || undefined,
      },
    });

    this.logger.debug(
      `Email log created: ${log.id} (${params.templateKey} to ${params.recipient})`,
    );
    return log.id;
  }

  /**
   * Update log entry to mark as sent
   */
  async markSent(logId: string, messageId?: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: EmailLogStatus.SENT,
        messageId,
        sentAt: new Date(),
      },
    });

    this.logger.debug(`Email log marked as sent: ${logId}`);
  }

  /**
   * Update log entry to mark as failed
   */
  async markFailed(logId: string, errorMessage: string, errorCode?: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: EmailLogStatus.FAILED,
        errorMessage,
        errorCode,
      },
    });

    this.logger.debug(`Email log marked as failed: ${logId} - ${errorMessage}`);
  }

  /**
   * Create a complete log entry (for one-shot logging)
   */
  async log(params: CreateEmailLogParams): Promise<string> {
    const log = await this.prisma.emailLog.create({
      data: {
        templateKey: params.templateKey,
        recipient: params.recipient,
        subject: params.subject,
        provider: params.provider,
        status: params.status,
        messageId: params.messageId,
        errorMessage: params.errorMessage,
        errorCode: params.errorCode,
        retryCount: params.retryCount || 0,
        relatedEntity: params.relatedEntity,
        relatedEntityId: params.relatedEntityId,
        metadataJson: params.metadata || undefined,
        sentAt: params.status === EmailLogStatus.SENT ? new Date() : null,
      },
    });

    this.logger.log(
      `Email ${params.status.toLowerCase()}: ${params.templateKey} to ${params.recipient} via ${params.provider}`,
    );
    return log.id;
  }

  /**
   * Get email logs for a recipient
   */
  async getByRecipient(
    recipient: string,
    options?: { limit?: number; offset?: number },
  ): Promise<any[]> {
    return this.prisma.emailLog.findMany({
      where: { recipient },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  /**
   * Get email logs for a related entity
   */
  async getByRelatedEntity(relatedEntity: string, relatedEntityId: string): Promise<any[]> {
    return this.prisma.emailLog.findMany({
      where: { relatedEntity, relatedEntityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get recent failed emails for monitoring
   */
  async getRecentFailures(limit: number = 100): Promise<any[]> {
    return this.prisma.emailLog.findMany({
      where: { status: EmailLogStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get email statistics for dashboard/monitoring
   */
  async getStatistics(since?: Date): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    const where = since ? { createdAt: { gte: since } } : {};

    const [total, sent, failed, pending] = await Promise.all([
      this.prisma.emailLog.count({ where }),
      this.prisma.emailLog.count({ where: { ...where, status: EmailLogStatus.SENT } }),
      this.prisma.emailLog.count({ where: { ...where, status: EmailLogStatus.FAILED } }),
      this.prisma.emailLog.count({ where: { ...where, status: EmailLogStatus.PENDING } }),
    ]);

    return { total, sent, failed, pending };
  }
}
