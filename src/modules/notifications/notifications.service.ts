import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Retry a failed or pending notification
   *
   * Behavior:
   * - Only FAILED or PENDING notifications can be retried
   * - Increments retry count
   * - Resets status to PENDING
   * - Clears error message
   * - In mock mode, simulates sending (marks as SENT after brief processing)
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

    // Only allow retry for FAILED or PENDING notifications
    const retryableStatuses: NotificationStatus[] = [
      NotificationStatus.FAILED,
      NotificationStatus.PENDING,
    ];
    if (!retryableStatuses.includes(notification.status)) {
      throw new BadRequestException('Notification cannot be retried', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Only failed or pending notifications can be retried. Current status: ${notification.status}`,
        },
      ]);
    }

    // Check max retry count
    if (notification.retryCount >= notification.maxRetryCount) {
      throw new BadRequestException('Maximum retry attempts reached', [
        {
          reason: ErrorCodes.UNPROCESSABLE_ENTITY,
          message: `Maximum retry count (${notification.maxRetryCount}) reached`,
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
      },
    });

    this.logger.log(`Notification retry queued: ${id} (attempt ${updatedNotification.retryCount})`);

    // Mock sending behavior - simulate async processing
    // In production, this would be handled by a background worker
    this.mockSendNotification(id);

    return this.mapToResponse(updatedNotification);
  }

  /**
   * Send a notification (creates record and queues for sending)
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
      },
    });

    this.logger.log(
      `Notification created: ${notification.id} (${params.channel} to ${params.recipient})`,
    );

    // Mock sending behavior
    this.mockSendNotification(notification.id);

    return this.mapToResponse(notification);
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
   * Mock notification sending
   *
   * In development/mock mode:
   * - Simulates processing delay
   * - Marks notification as SENT
   * - In production, this would be replaced by actual SMTP/SMS/Push logic
   */
  private async mockSendNotification(notificationId: string): Promise<void> {
    // Simulate async processing (don't await - fire and forget)
    setTimeout(async () => {
      try {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
          },
        });
        this.logger.log(`[MOCK] Notification sent: ${notificationId}`);
      } catch (error) {
        this.logger.error(`[MOCK] Failed to update notification: ${notificationId}`, error);
      }
    }, 1000); // 1 second delay to simulate processing
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
      sentAt: notification.sentAt || undefined,
      failedAt: notification.failedAt || undefined,
      errorMessage: notification.errorMessage || undefined,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
