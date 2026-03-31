import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationResponseDto } from './dto';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

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
   * Send a notification (placeholder - actual sending logic to be implemented)
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

    // TODO: Implement actual sending logic based on channel
    // - EMAIL: Use email service (SendGrid, SES, etc.)
    // - SMS: Use SMS provider (Twilio, etc.)
    // - PUSH: Use push notification service (Firebase, etc.)

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

  private mapToResponse(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      channel: notification.channel,
      templateKey: notification.templateKey,
      recipient: notification.recipient,
      subject: notification.subject || undefined,
      payloadJson: notification.payloadJson as Record<string, any>,
      status: notification.status,
      sentAt: notification.sentAt || undefined,
      failedAt: notification.failedAt || undefined,
      errorMessage: notification.errorMessage || undefined,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
