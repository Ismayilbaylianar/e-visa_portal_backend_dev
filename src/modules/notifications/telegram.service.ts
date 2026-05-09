import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_REGISTRY, EventChannel } from './event-registry';

/**
 * M11.5 — TelegramNotificationService.
 *
 * Wraps the Bot API `sendMessage` endpoint:
 *   - Persists every event to `notification_events` first (status
 *     `pending` | `skipped` based on the kill-switch).
 *   - Sends with a 1-rps-per-chat token bucket so we never trip
 *     Telegram's 30-msgs/sec global cap.
 *   - Retries 5xx + 429 with exponential backoff (max 3 attempts)
 *     via a setInterval-driven processor — no @nestjs/schedule dep.
 *   - Escapes MarkdownV2 special chars in titles, bodies, and the
 *     JSON context dump so weird customer emails (`a_b@c.io`) don't
 *     blow up the parse.
 *
 * Bot token NEVER appears in DB rows, audit logs, or response
 * bodies — only inside the outbound HTTPS request URL.
 */

interface SendArgs {
  eventType: string;
  channel: EventChannel;
  title: string;
  body: string;
  context?: Record<string, unknown>;
}

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]; // 1s · 2s · 4s
const MAX_ATTEMPTS = 3;
const RETRY_TICK_INTERVAL_MS = 30_000; // every 30s
const PER_CHAT_INTERVAL_MS = 1_000;    // 1 msg/sec/chat
const TELEGRAM_API_TIMEOUT_MS = 10_000;

@Injectable()
export class TelegramNotificationService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly botToken: string;
  private readonly enabled: boolean;
  private readonly chatIds: Record<EventChannel, string>;
  /** Last-send timestamp per chatId — drives the 1 rps limiter. */
  private readonly lastSentAt = new Map<string, number>();
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.botToken = this.config.get<string>('app.telegram.botToken') ?? '';
    this.enabled = this.config.get<boolean>('app.telegram.enabled') ?? false;
    this.chatIds = {
      alerts: this.config.get<string>('app.telegram.alertsChatId') ?? '',
      activity: this.config.get<string>('app.telegram.activityChatId') ?? '',
    };
    if (this.enabled && !this.botToken) {
      this.logger.warn(
        'TELEGRAM_ENABLED=true but TELEGRAM_BOT_TOKEN is empty — every send will be marked failed. Add the token to .env and restart.',
      );
    }
  }

  onModuleInit() {
    // Background retry processor — picks up `status='pending'` rows
    // older than the next backoff window and re-attempts. Kept
    // minimal (no @nestjs/schedule dep).
    this.retryTimer = setInterval(
      () => this.processRetryQueue().catch((e) =>
        this.logger.error(`Retry processor failed: ${(e as Error).message}`),
      ),
      RETRY_TICK_INTERVAL_MS,
    );
  }

  /**
   * Enqueue + attempt to send a notification. Always creates a DB
   * row first (so the UI feed shows the attempt even if Telegram
   * is muted or fails). When the kill-switch is off we short-circuit
   * to `status='skipped'` and return.
   */
  async send(args: SendArgs): Promise<{ id: string; status: string }> {
    const channel = args.channel;
    const severity = EVENT_REGISTRY[args.eventType]?.severity ?? channel;

    const event = await this.prisma.notificationEvent.create({
      data: {
        eventType: args.eventType,
        severity,
        channel,
        title: args.title,
        body: args.body,
        contextJson: (args.context ?? null) as any,
        status: this.enabled && this.botToken ? 'pending' : 'skipped',
      },
    });

    if (!this.enabled || !this.botToken) {
      this.logger.debug(
        `Telegram skipped (enabled=${this.enabled}, hasToken=${!!this.botToken}) for ${args.eventType}`,
      );
      return { id: event.id, status: 'skipped' };
    }

    const ok = await this.attemptSend(event.id, args);
    return { id: event.id, status: ok ? 'sent' : 'pending' };
  }

  /** Used by the admin /notifications/test endpoint. */
  async sendTest(channel: EventChannel): Promise<{ id: string; status: string }> {
    const title = channel === 'alerts' ? 'Test Alert' : 'Test Activity';
    const body =
      `This is a test message from the E-Visa admin panel.\n` +
      `If you can read this, the ${channel} channel is wired up correctly.`;
    return this.send({
      eventType: '_test',
      channel,
      title,
      body,
      context: { triggeredAt: new Date().toISOString() },
    });
  }

  /** Single attempt — returns true on 2xx, false otherwise. */
  private async attemptSend(eventId: string, args: SendArgs): Promise<boolean> {
    const chatId = this.chatIds[args.channel];
    if (!chatId) {
      await this.markFailed(eventId, `No chat ID configured for channel '${args.channel}'`);
      return false;
    }

    // Per-chat rate limit (1 msg/sec). If we'd exceed it, sleep
    // until the bucket refills. Cheap when we're idle, prevents
    // 429 storms when bursts of events fire (e.g. bulk approve).
    const last = this.lastSentAt.get(chatId) ?? 0;
    const wait = PER_CHAT_INTERVAL_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const text = this.formatMessage(args);
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.lastSentAt.set(chatId, Date.now());
    } catch (e) {
      // Network error — retryable.
      await this.markPendingRetry(eventId, `Network error: ${(e as Error).message}`);
      return false;
    }

    if (response.ok) {
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'sent', sentAt: new Date() },
      });
      return true;
    }

    // Telegram error envelope: { ok:false, description, error_code }
    let bodyText = '';
    try {
      bodyText = (await response.text()).slice(0, 500);
    } catch {
      bodyText = `HTTP ${response.status}`;
    }

    if (response.status === 429 || response.status >= 500) {
      // Retryable — leave as pending so the processor picks it up.
      await this.markPendingRetry(eventId, `HTTP ${response.status}: ${bodyText}`);
      return false;
    }
    // 4xx other than 429 — not retryable (bad chat ID, parse error, etc).
    await this.markFailed(eventId, `HTTP ${response.status}: ${bodyText}`);
    return false;
  }

  /**
   * Periodic retry sweep. Picks up to 10 pending rows whose next
   * backoff window has elapsed, and re-attempts each. Limits the
   * batch to keep one tick under a few seconds even if Telegram
   * is slow.
   */
  private async processRetryQueue(): Promise<void> {
    if (!this.enabled || !this.botToken) return;
    const candidates = await this.prisma.notificationEvent.findMany({
      where: { status: 'pending', attemptCount: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    if (candidates.length === 0) return;

    for (const event of candidates) {
      const delay = RETRY_DELAYS_MS[event.attemptCount - 1] ?? RETRY_DELAYS_MS[0];
      const eligibleAt = event.createdAt.getTime() + delay;
      if (Date.now() < eligibleAt) continue;
      await this.attemptSend(event.id, {
        eventType: event.eventType,
        channel: event.channel as EventChannel,
        title: event.title,
        body: event.body,
        context: (event.contextJson as Record<string, unknown> | null) ?? undefined,
      });
    }
  }

  private async markPendingRetry(eventId: string, lastError: string) {
    const ev = await this.prisma.notificationEvent.update({
      where: { id: eventId },
      data: { attemptCount: { increment: 1 }, lastError },
    });
    if (ev.attemptCount >= MAX_ATTEMPTS) {
      await this.prisma.notificationEvent.update({
        where: { id: eventId },
        data: { status: 'failed' },
      });
      this.logger.warn(
        `Telegram event ${eventId} (${ev.eventType}) gave up after ${MAX_ATTEMPTS} attempts: ${lastError}`,
      );
    }
  }

  private async markFailed(eventId: string, lastError: string) {
    await this.prisma.notificationEvent.update({
      where: { id: eventId },
      data: { status: 'failed', attemptCount: { increment: 1 }, lastError },
    });
    this.logger.warn(`Telegram event ${eventId} failed (non-retryable): ${lastError}`);
  }

  /**
   * Compose the MarkdownV2 message. The escaper is per-Telegram-spec —
   * the full set of reserved chars is `_*[]()~\`>#+-=|{}.!`. We
   * escape title, body, and any JSON dump separately, then stitch.
   */
  private formatMessage(args: SendArgs): string {
    const emoji = args.channel === 'alerts' ? '🚨' : '✅';
    const lines: string[] = [];
    lines.push(`${emoji} *${escapeMarkdownV2(args.title)}*`);
    lines.push('');
    lines.push(escapeMarkdownV2(args.body));
    if (args.context && Object.keys(args.context).length > 0) {
      // ```...``` blocks don't need inner escaping in MarkdownV2 —
      // backticks alone delimit. Keep the JSON pretty for readability.
      const json = JSON.stringify(redactSensitive(args.context), null, 2).slice(0, 1500);
      lines.push('');
      lines.push('```');
      lines.push(json);
      lines.push('```');
    }
    lines.push('');
    lines.push(`_${escapeMarkdownV2(new Date().toISOString())}_`);
    return lines.join('\n');
  }
}

/**
 * MarkdownV2 escaper. Mutating these chars unescaped causes
 * Telegram's parser to reject the whole message with HTTP 400.
 */
export function escapeMarkdownV2(text: string): string {
  return String(text ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

/**
 * Defensive — strip anything that smells like a credential before
 * we splat the context into a public-ish channel. Even though our
 * channels are private, treat them as one-step-from-public.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authorization',
]);
function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactSensitive(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
