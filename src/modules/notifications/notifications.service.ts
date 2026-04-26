import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationResponseDto, GetNotificationsQueryDto } from './dto';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';

export interface SendNotificationParams {
  channel: NotificationChannel;
  templateKey: string;
  recipient: string;
  subject?: string;
  payload: Record<string, any>;
  maxRetryCount?: number;
}

/**
 * Valid status transitions for notifications
 */
const VALID_STATUS_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  [NotificationStatus.PENDING]: [NotificationStatus.PROCESSING, NotificationStatus.FAILED],
  [NotificationStatus.PROCESSING]: [NotificationStatus.SENT, NotificationStatus.FAILED],
  [NotificationStatus.SENT]: [NotificationStatus.DELIVERED],
  [NotificationStatus.FAILED]: [NotificationStatus.PENDING], // Only via retry
  [NotificationStatus.DELIVERED]: [],
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly useMockSending: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    // Use mock sending only if EMAIL_PROVIDER is explicitly 'mock' or not configured
    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER', 'auto');
    this.useMockSending = emailProvider === 'mock';
    this.logger.log(`Notifications service initialized (mock sending: ${this.useMockSending})`);
  }

  /**
   * Get paginated list of notifications with filters
   */
  async findAll(
    query: GetNotificationsQueryDto,
  ): Promise<{ items: NotificationResponseDto[]; pagination: PaginationMeta }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      channel,
      status,
      templateKey,
      recipient,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (channel) {
      where.channel = channel;
    }
    if (status) {
      where.status = status;
    }
    if (templateKey) {
      where.templateKey = { contains: templateKey, mode: 'insensitive' };
    }
    if (recipient) {
      where.recipient = { contains: recipient, mode: 'insensitive' };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const items = notifications.map(n => this.mapToResponse(n));

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
   * Get notification by ID
   */
  async findById(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Notification not found' },
      ]);
    }

    return this.mapToResponse(notification);
  }

  /**
   * Retry a failed notification
   *
   * Behavior:
   * - Only FAILED notifications can be retried (PENDING should process automatically)
   * - Validates retry count hasn't exceeded max
   * - Increments retry count
   * - Resets status to PENDING
   * - Clears error message
   * - Queues for reprocessing
   *
   * Returns immediately with updated notification state.
   * Actual sending happens asynchronously.
   */
  async retry(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Notification not found' },
      ]);
    }

    // Only FAILED notifications should be retried
    // PENDING notifications should be picked up automatically
    // PROCESSING, SENT, DELIVERED cannot be retried
    if (notification.status !== NotificationStatus.FAILED) {
      throw new BadRequestException('Notification cannot be retried', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Only failed notifications can be retried. Current status: ${notification.status}`,
        },
      ]);
    }

    // Check max retry count
    if (notification.retryCount >= notification.maxRetryCount) {
      throw new BadRequestException('Maximum retry attempts reached', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Maximum retry count (${notification.maxRetryCount}) has been reached. This notification cannot be retried further.`,
        },
      ]);
    }

    // Update notification for retry
    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.PENDING,
        retryCount: { increment: 1 },
        errorMessage: null,
        failedAt: null,
        provider: null,
        messageId: null,
      },
    });

    this.logger.log(
      `Notification retry queued: ${id} (attempt ${updatedNotification.retryCount}/${updatedNotification.maxRetryCount})`,
    );

    // Process notification (fire-and-forget, don't block the response)
    // TODO [FUTURE QUEUE INTEGRATION]: Replace with job queue dispatch
    this.processNotification(id).catch(error => {
      this.logger.error(`Error processing notification retry ${id}: ${error.message}`);
    });

    return this.mapToResponse(updatedNotification);
  }

  /**
   * Send a notification (creates record and queues for sending)
   *
   * Creates a notification record and immediately begins processing.
   * Returns the created notification without waiting for send completion.
   *
   * @param params - Notification parameters
   * @returns Created notification record
   *
   * TODO [FUTURE QUEUE INTEGRATION]:
   * Instead of calling processNotification directly, dispatch to job queue.
   * This would allow for better retry handling, rate limiting, and monitoring.
   */
  async send(params: SendNotificationParams): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.create({
      data: {
        channel: params.channel,
        templateKey: params.templateKey,
        recipient: params.recipient,
        subject: params.subject,
        payloadJson: params.payload,
        status: NotificationStatus.PENDING,
        maxRetryCount: params.maxRetryCount ?? 3,
      },
    });

    this.logger.log(
      `Notification created: ${notification.id} (${params.channel} to ${params.recipient})`,
    );

    // Process notification (fire-and-forget, don't block the response)
    // The notification will be processed asynchronously
    this.processNotification(notification.id).catch(error => {
      this.logger.error(`Error processing notification ${notification.id}: ${error.message}`);
    });

    return this.mapToResponse(notification);
  }

  /**
   * Queue a notification for later sending (without immediate processing)
   *
   * Creates a notification in PENDING state without triggering immediate send.
   * Useful for batch operations or when you want to control send timing.
   *
   * TODO [FUTURE QUEUE INTEGRATION]:
   * This is the preferred method for queue-based systems.
   */
  async queue(params: SendNotificationParams): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.create({
      data: {
        channel: params.channel,
        templateKey: params.templateKey,
        recipient: params.recipient,
        subject: params.subject,
        payloadJson: params.payload,
        status: NotificationStatus.PENDING,
        maxRetryCount: params.maxRetryCount ?? 3,
      },
    });

    this.logger.log(
      `Notification queued: ${notification.id} (${params.channel} to ${params.recipient})`,
    );

    return this.mapToResponse(notification);
  }

  /**
   * Process a specific pending notification
   *
   * Can be called manually or by a background worker.
   */
  async processById(id: string): Promise<void> {
    await this.processNotification(id);
  }

  /**
   * Find notifications by recipient
   */
  async findByRecipient(recipient: string): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipient },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map(n => this.mapToResponse(n));
  }

  /**
   * Process and send a notification
   *
   * This method orchestrates the notification sending process:
   * 1. Validates current status allows processing
   * 2. Transitions to PROCESSING state
   * 3. Attempts to send via appropriate channel
   * 4. Updates final status based on result
   *
   * Production Notes:
   * - State transitions are validated before updates
   * - All errors are captured and persisted
   * - Provider information is tracked for debugging
   *
   * TODO [FUTURE QUEUE INTEGRATION]:
   * This method can be refactored to be called by a background worker.
   * The current sync approach works for moderate volumes.
   * For high volume, wrap this in a job/queue system.
   */
  private async processNotification(notificationId: string): Promise<void> {
    // Fetch current notification state
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.error(`Notification not found for processing: ${notificationId}`);
      return;
    }

    // Validate status transition to PROCESSING
    if (!this.canTransitionTo(notification.status, NotificationStatus.PROCESSING)) {
      this.logger.warn(
        `Cannot process notification ${notificationId}: invalid status transition from ${notification.status}`,
      );
      return;
    }

    // Mark as processing
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.PROCESSING },
    });

    // For mock mode, simulate success after delay
    if (this.useMockSending) {
      this.processMockNotification(notificationId, notification.channel);
      return;
    }

    // Real sending based on channel
    if (notification.channel === NotificationChannel.EMAIL) {
      await this.processEmailNotification(notificationId, notification);
    } else {
      // SMS and PUSH channels - mock for now
      // TODO [FUTURE INTEGRATION]: Add real SMS/Push providers here
      this.processMockNotification(notificationId, notification.channel);
    }
  }

  /**
   * Process EMAIL channel notification with real sending
   */
  private async processEmailNotification(notificationId: string, notification: any): Promise<void> {
    try {
      const payload = notification.payloadJson as Record<string, any>;

      // Try to send via email service
      const result = await this.emailService.sendTemplatedEmail({
        to: notification.recipient,
        templateKey: notification.templateKey,
        variables: payload,
        relatedEntity: 'Notification',
        relatedEntityId: notificationId,
      });

      if (result.success) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            provider: result.provider,
            messageId: result.messageId,
            errorMessage: null,
          },
        });
        this.logger.log(
          `Notification sent: ${notificationId} via ${result.provider} [${result.messageId}]`,
        );
      } else {
        await this.markNotificationFailed(
          notificationId,
          result.error || 'Email send failed',
          result.provider,
        );
      }
    } catch (error: any) {
      await this.markNotificationFailed(
        notificationId,
        error.message || 'Unexpected error during send',
      );
    }
  }

  /**
   * Process mock notification (for dev mode or unsupported channels)
   */
  private processMockNotification(notificationId: string, channel: NotificationChannel): void {
    // Simulate async processing
    setTimeout(async () => {
      try {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            provider: 'mock',
          },
        });
        this.logger.log(`[MOCK] ${channel} notification sent: ${notificationId}`);
      } catch (error) {
        this.logger.error(`[MOCK] Failed to update notification: ${notificationId}`, error);
      }
    }, 500);
  }

  /**
   * Mark a notification as failed
   */
  private async markNotificationFailed(
    notificationId: string,
    errorMessage: string,
    provider?: string,
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        errorMessage,
        provider: provider || undefined,
      },
    });
    this.logger.error(`Notification failed: ${notificationId} - ${errorMessage}`);
  }

  /**
   * Check if a status transition is valid
   */
  private canTransitionTo(from: NotificationStatus, to: NotificationStatus): boolean {
    return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private mapToResponse(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      channel: notification.channel,
      templateKey: notification.templateKey,
      recipient: notification.recipient,
      subject: notification.subject || undefined,
      payloadJson: notification.payloadJson as Record<string, any>,
      status: notification.status,
      retryCount: notification.retryCount,
      maxRetryCount: notification.maxRetryCount,
      provider: notification.provider || undefined,
      messageId: notification.messageId || undefined,
      sentAt: notification.sentAt || undefined,
      failedAt: notification.failedAt || undefined,
      errorMessage: notification.errorMessage || undefined,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
