import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Notification UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Template key used for this notification',
    example: 'application_submitted',
  })
  templateKey: string;

  @ApiProperty({
    description: 'Recipient (email, phone, or device token)',
    example: 'user@example.com',
  })
  recipient: string;

  @ApiPropertyOptional({
    description: 'Notification subject (for email)',
    example: 'Your application has been submitted',
  })
  subject?: string;

  @ApiProperty({
    description: 'Payload data used for template rendering',
    example: { applicationId: '123', applicantName: 'John Doe' },
  })
  payloadJson: Record<string, any>;

  @ApiProperty({
    description: 'Notification status',
    enum: NotificationStatus,
    example: NotificationStatus.SENT,
  })
  status: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Retry count',
    example: 0,
  })
  retryCount?: number;

  @ApiPropertyOptional({
    description: 'Timestamp when notification was sent',
  })
  sentAt?: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when notification failed',
  })
  failedAt?: Date;

  @ApiPropertyOptional({
    description: 'Error message if notification failed',
    example: 'SMTP connection timeout',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
