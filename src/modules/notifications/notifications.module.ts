import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
// M11.5 — Telegram twin-channel additions.
import { AdminNotificationEventsController } from './admin-notification-events.controller';
import { NotificationEventsService } from './notification-events.service';
import { TelegramNotificationService } from './telegram.service';
import { NotificationEmitterService } from './notification-emitter.service';
import { AuditLogsModule } from '../auditLogs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [NotificationsController, AdminNotificationEventsController],
  providers: [
    NotificationsService,
    NotificationEventsService,
    TelegramNotificationService,
    NotificationEmitterService,
  ],
  exports: [
    NotificationsService,
    // M11.5 — exported so other modules (apps, payments, auth) can
    // inject the emitter and fire events from their service code.
    NotificationEmitterService,
    TelegramNotificationService,
  ],
})
export class NotificationsModule {}
