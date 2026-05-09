import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramNotificationService } from './telegram.service';
import { ALL_EVENT_KEYS, EVENT_REGISTRY } from './event-registry';
import {
  GetNotificationEventsQueryDto,
  NotificationEventResponseDto,
  NotificationSettingResponseDto,
  NotificationStatsResponseDto,
  TestNotificationDto,
  UpdateNotificationSettingDto,
} from './dto';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { ActorType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * M11.5 — Service for the admin /notification-events endpoints.
 *
 * Three responsibilities:
 *   1. Paginated read of `notification_events` for the UI feed.
 *   2. Stats aggregation (24h windows + top event types).
 *   3. Per-event-type toggle CRUD against `notification_settings`,
 *      with the ability to send a test message to either channel.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegram: TelegramNotificationService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(query: GetNotificationEventsQueryDto): Promise<{
    items: NotificationEventResponseDto[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.severity) where.severity = query.severity;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.eventType) where.eventType = query.eventType;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    const [rows, total] = await Promise.all([
      this.prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notificationEvent.count({ where }),
    ]);
    return {
      items: rows.map(toResponse),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async stats(): Promise<NotificationStatsResponseDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [alerts24h, activity24h, failed24h, skipped24h, byEventTypeRaw] = await Promise.all([
      this.prisma.notificationEvent.count({
        where: { severity: 'alert', createdAt: { gte: since } },
      }),
      this.prisma.notificationEvent.count({
        where: { severity: 'activity', createdAt: { gte: since } },
      }),
      this.prisma.notificationEvent.count({
        where: { status: 'failed', createdAt: { gte: since } },
      }),
      this.prisma.notificationEvent.count({
        where: { status: 'skipped', createdAt: { gte: since } },
      }),
      this.prisma.notificationEvent.groupBy({
        by: ['eventType'],
        where: { createdAt: { gte: since } },
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
        take: 10,
      }),
    ]);
    // M11.5.1 — Twin-bot status. Read via the service so we don't
    // duplicate the env-key strings here; stays in sync if the
    // resolver ever pulls from somewhere else (e.g. a Settings table).
    const channelState = this.telegram.getChannelConfigState();
    return {
      alerts24h,
      activity24h,
      failed24h,
      skipped24h,
      telegramEnabled: channelState.enabled,
      alertsBotConfigured: channelState.alertsBotConfigured,
      activityBotConfigured: channelState.activityBotConfigured,
      byEventType: byEventTypeRaw.map((r) => ({
        eventType: r.eventType,
        count: r._count.eventType,
      })),
    };
  }

  async sendTest(
    dto: TestNotificationDto,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ id: string; status: string; channel: string }> {
    const channel = dto.channel ?? 'alerts';
    const result = await this.telegram.sendTest(channel);
    await this.auditLogsService.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'notification.test_sent',
      entityType: 'NotificationEvent',
      entityId: result.id,
      newValue: { channel, status: result.status },
      ipAddress,
      userAgent,
    });
    return { id: result.id, status: result.status, channel };
  }

  async listSettings(): Promise<NotificationSettingResponseDto[]> {
    // Compose registry + DB rows so the response always covers every
    // known event, even if the seed for that event hasn't run yet.
    const rows = await this.prisma.notificationSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.eventType, r]));
    return ALL_EVENT_KEYS.map((eventType) => {
      const spec = EVENT_REGISTRY[eventType];
      const row = byKey.get(eventType);
      return {
        eventType,
        enabled: row?.enabled ?? spec.defaultEnabled,
        channel: row?.channel ?? spec.channel,
        description: row?.description ?? spec.description,
        updatedAt: row?.updatedAt ?? new Date(0),
      };
    });
  }

  async updateSetting(
    eventType: string,
    dto: UpdateNotificationSettingDto,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<NotificationSettingResponseDto> {
    const spec = EVENT_REGISTRY[eventType];
    if (!spec) {
      throw new NotFoundException('Unknown notification event type', [
        { reason: ErrorCodes.NOT_FOUND, message: `No event with key '${eventType}'` },
      ]);
    }
    if (typeof dto.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be true or false', [
        { field: 'enabled', reason: ErrorCodes.BAD_REQUEST, message: 'enabled is required' },
      ]);
    }
    const before = await this.prisma.notificationSetting.findUnique({
      where: { eventType },
    });
    const upserted = await this.prisma.notificationSetting.upsert({
      where: { eventType },
      create: {
        eventType,
        enabled: dto.enabled,
        channel: spec.channel,
        description: spec.description,
      },
      update: { enabled: dto.enabled },
    });
    await this.auditLogsService.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'notification.settings_updated',
      entityType: 'NotificationSetting',
      entityId: eventType,
      oldValue: before ? { enabled: before.enabled } : { enabled: spec.defaultEnabled },
      newValue: { enabled: upserted.enabled },
      ipAddress,
      userAgent,
    });
    return {
      eventType: upserted.eventType,
      enabled: upserted.enabled,
      channel: upserted.channel,
      description: upserted.description ?? undefined,
      updatedAt: upserted.updatedAt,
    };
  }
}

function toResponse(row: any): NotificationEventResponseDto {
  return {
    id: row.id,
    eventType: row.eventType,
    severity: row.severity,
    channel: row.channel,
    title: row.title,
    body: row.body,
    contextJson: row.contextJson ?? undefined,
    status: row.status,
    attemptCount: row.attemptCount,
    lastError: row.lastError ?? undefined,
    sentAt: row.sentAt ?? undefined,
    createdAt: row.createdAt,
  };
}
