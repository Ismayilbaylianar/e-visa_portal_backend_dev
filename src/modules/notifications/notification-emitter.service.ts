import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramNotificationService } from './telegram.service';
import { EVENT_REGISTRY, EventKey } from './event-registry';

/**
 * M11.5 — NotificationEmitterService.
 *
 * The single function call sites use to fire a notification:
 *   await emitter.emit('app.submitted', { applicationCode, … });
 *
 * Responsibilities:
 *   1. Look up the registry spec
 *   2. Check the per-event toggle in `notification_settings`
 *      (default-on if the row doesn't exist yet)
 *   3. Render the title + body via the spec
 *   4. Hand to TelegramNotificationService.send()
 *
 * Failures here MUST NOT break the caller — every business
 * operation that emits a notification is wrapped in a try/catch
 * here so a Telegram outage can't roll back e.g. an application
 * approval.
 */
@Injectable()
export class NotificationEmitterService {
  private readonly logger = new Logger(NotificationEmitterService.name);
  /**
   * In-memory sliding window for `auth.login_failed_repeated`.
   * `{ ip → { firstAt, count, alertedAt } }`. Trades a tiny
   * amount of RAM for not standing up Redis. Resets on restart;
   * acceptable for V1 (the alert exists to flag obvious bursts).
   */
  private readonly loginFailureWindow = new Map<
    string,
    { firstAt: number; count: number; alertedAt: number }
  >();

  /** 5 failures in 10 min triggers; cooldown 1 hour after each alert. */
  private static readonly BRUTE_THRESHOLD = 5;
  private static readonly BRUTE_WINDOW_MS = 10 * 60 * 1000;
  private static readonly BRUTE_COOLDOWN_MS = 60 * 60 * 1000;
  private static readonly BRUTE_WINDOW_MIN = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  async emit(eventKey: EventKey | string, context: Record<string, any>): Promise<void> {
    try {
      const spec = EVENT_REGISTRY[eventKey];
      if (!spec) {
        this.logger.warn(`Unknown notification event: ${eventKey}`);
        return;
      }

      // Check the per-event toggle. Missing row = treat as enabled
      // (the seed populates rows but a freshly-deployed event might
      // not have run the seed yet).
      const setting = await this.prisma.notificationSetting.findUnique({
        where: { eventType: String(eventKey) },
      });
      if (setting && !setting.enabled) {
        await this.prisma.notificationEvent.create({
          data: {
            eventType: String(eventKey),
            severity: spec.severity,
            channel: spec.channel,
            title: spec.render(context).title,
            body: spec.render(context).body,
            contextJson: context as any,
            status: 'skipped',
          },
        });
        return;
      }

      const rendered = spec.render(context);
      await this.telegram.send({
        eventType: String(eventKey),
        channel: spec.channel,
        title: rendered.title,
        body: rendered.body,
        context,
      });
    } catch (e) {
      // Don't throw — notification failures must not bubble into
      // the business operation that fired them.
      this.logger.error(
        `Failed to emit notification ${eventKey}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Helper for the auth flow. Call on every login failure with the
   * attempt's IP + email. Returns true when the brute-force alert
   * fires this call (caller can use that to log additionally).
   */
  recordLoginFailure(args: { ip?: string; email?: string; userAgent?: string }): void {
    const ip = args.ip ?? 'unknown';
    const now = Date.now();
    const window = this.loginFailureWindow.get(ip);

    if (!window || now - window.firstAt > NotificationEmitterService.BRUTE_WINDOW_MS) {
      this.loginFailureWindow.set(ip, { firstAt: now, count: 1, alertedAt: 0 });
      return;
    }

    window.count++;

    // Once we've alerted, hold off for the cooldown window before
    // re-alerting from the same IP.
    if (
      window.count >= NotificationEmitterService.BRUTE_THRESHOLD &&
      now - window.alertedAt > NotificationEmitterService.BRUTE_COOLDOWN_MS
    ) {
      window.alertedAt = now;
      void this.emit('auth.login_failed_repeated', {
        ip,
        email: args.email,
        userAgent: args.userAgent,
        attemptCount: window.count,
        windowMinutes: NotificationEmitterService.BRUTE_WINDOW_MIN,
      });
    }
  }
}
