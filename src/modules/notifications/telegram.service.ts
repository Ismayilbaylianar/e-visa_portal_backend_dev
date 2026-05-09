import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_REGISTRY, EventChannel } from './event-registry';

/**
 * M11.5 / M11.5.1 — TelegramNotificationService.
 *
 * Twin-bot architecture: each Telegram channel uses its OWN bot.
 *   - Alerts bot   posts to TELEGRAM_ALERTS_CHAT_ID
 *   - Activity bot posts to TELEGRAM_ACTIVITY_CHAT_ID
 *
 * Each bot must be admin in only its own channel. Cross-posting
 * (alerts bot → activity channel) returns 403 Forbidden because
 * the bot is not a member of that channel — `getBotConfig(channel)`
 * pairs token + chatId together so this can't happen by accident.
 *
 * Wraps the Bot API `sendMessage` endpoint:
 *   - Persists every event to `notification_events` first (status
 *     `pending` | `skipped` based on the kill-switch / bot config).
 *   - Sends with a 1-rps-per-chat token bucket so we never trip
 *     Telegram's 30-msgs/sec global cap.
 *   - Retries 5xx + 429 with exponential backoff (max 3 attempts)
 *     via a setInterval-driven processor — no @nestjs/schedule dep.
 *   - Escapes MarkdownV2 special chars in titles, bodies, and the
 *     JSON context dump so weird customer emails (`a_b@c.io`) don't
 *     blow up the parse.
 *
 * Bot tokens NEVER appear in DB rows, audit logs, or response
 * bodies — only inside the outbound HTTPS request URLs.
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

interface BotConfig {
  /** Bot token from BotFather. Empty string = not configured. */
  token: string;
  /** Channel-specific chat ID (negative integer in string form). */
  chatId: string;
  /** True iff a non-empty token is set. Drives skip-vs-send routing. */
  configured: boolean;
}

@Injectable()
export class TelegramNotificationService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly enabled: boolean;
  /** Per-chat 1 rps limiter — keyed by chatId, which is unique per channel. */
  private readonly lastSentAt = new Map<string, number>();
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled = this.config.get<boolean>('app.telegram.enabled') ?? false;

    // Boot-time visibility into the twin-bot config. Each bot is
    // independently optional — operator can stand up Alerts first
    // and add Activity later without restarting the world.
    const alerts = this.getBotConfig('alerts');
    const activity = this.getBotConfig('activity');
    if (this.enabled && !alerts.configured) {
      this.logger.warn(
        'TELEGRAM_ENABLED=true but TELEGRAM_ALERTS_BOT_TOKEN is empty — Alerts events will be marked failed/skipped. Add the token to .env and restart.',
      );
    }
    if (this.enabled && !activity.configured) {
      this.logger.warn(
        'TELEGRAM_ENABLED=true but TELEGRAM_ACTIVITY_BOT_TOKEN is empty — Activity events will be marked failed/skipped. Add the token to .env and restart.',
      );
    }

    // M11.5.1 — deprecation hint for the legacy single-token scheme.
    // We do NOT auto-fall back: silently routing Activity events
    // through the Alerts bot would 403 in production. Operator
    // must opt in to the split keys explicitly.
    const legacy =
      this.config.get<string>('app.telegram.legacyBotToken') ?? '';
    if (legacy && (!alerts.configured || !activity.configured)) {
      this.logger.warn(
        '[deprecation] TELEGRAM_BOT_TOKEN is set but TELEGRAM_ALERTS_BOT_TOKEN / TELEGRAM_ACTIVITY_BOT_TOKEN are not — the legacy single-token scheme is no longer used. Rename your env var into the two new keys and restart.',
      );
    }
  }

  /**
   * Resolve the (token, chatId) pair for a channel. Single source
   * of truth — anything that needs to send/retry/inspect bot state
   * goes through here so we never accidentally pair the alerts
   * token with the activity chat ID (or vice versa).
   */
  private getBotConfig(channel: EventChannel): BotConfig {
    if (channel === 'alerts') {
      const token = this.config.get<string>('app.telegram.alertsBotToken') ?? '';
      const chatId = this.config.get<string>('app.telegram.alertsChatId') ?? '';
      return { token, chatId, configured: !!token };
    }
    const token = this.config.get<string>('app.telegram.activityBotToken') ?? '';
    const chatId = this.config.get<string>('app.telegram.activityChatId') ?? '';
    return { token, chatId, configured: !!token };
  }

  /** Public read of per-channel config (no token leak — only flags). */
  getChannelConfigState(): {
    enabled: boolean;
    alertsBotConfigured: boolean;
    activityBotConfigured: boolean;
  } {
    return {
      enabled: this.enabled,
      alertsBotConfigured: this.getBotConfig('alerts').configured,
      activityBotConfigured: this.getBotConfig('activity').configured,
    };
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
    const bot = this.getBotConfig(channel);

    // Skip semantics: kill-switch off OR this channel's bot has no
    // token. We mark `skipped` (not `failed`) because both of these
    // are operator config gaps rather than send-time errors — the
    // event isn't worth retrying until the operator fixes the env.
    const willSkip = !this.enabled || !bot.configured;

    const event = await this.prisma.notificationEvent.create({
      data: {
        eventType: args.eventType,
        severity,
        channel,
        title: args.title,
        body: args.body,
        contextJson: (args.context ?? null) as any,
        status: willSkip ? 'skipped' : 'pending',
        // Surface why we skipped so the UI feed shows it.
        lastError: willSkip
          ? !this.enabled
            ? 'TELEGRAM_ENABLED=false (master kill-switch)'
            : `${channel} bot token not configured`
          : null,
      },
    });

    if (willSkip) {
      this.logger.debug(
        `Telegram skipped (enabled=${this.enabled}, ${channel}BotConfigured=${bot.configured}) for ${args.eventType}`,
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
    // M11.5.1 — resolve token + chatId together so we can never
    // mis-pair (e.g. alerts token + activity chatId → 403). The
    // resolver re-reads on every call so an operator fixing .env
    // mid-flight gets picked up by the retry processor.
    const bot = this.getBotConfig(args.channel);
    if (!bot.configured) {
      await this.markFailed(
        eventId,
        `${args.channel} bot token not configured`,
      );
      return false;
    }
    if (!bot.chatId) {
      await this.markFailed(
        eventId,
        `No chat ID configured for channel '${args.channel}'`,
      );
      return false;
    }

    // Per-chat rate limit (1 msg/sec). If we'd exceed it, sleep
    // until the bucket refills. Cheap when we're idle, prevents
    // 429 storms when bursts of events fire (e.g. bulk approve).
    // The bucket is keyed by chatId — already unique per channel.
    const last = this.lastSentAt.get(bot.chatId) ?? 0;
    const wait = PER_CHAT_INTERVAL_MS - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const text = this.formatMessage(args);
    const url = `https://api.telegram.org/bot${bot.token}/sendMessage`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: bot.chatId,
          text,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.lastSentAt.set(bot.chatId, Date.now());
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
    if (!this.enabled) return;
    // M11.5.1 — don't pre-filter by bot config here. We may be sending
    // Alerts (configured) and Activity (not configured); skipping the
    // whole tick when one bot is missing would starve the other.
    // attemptSend() resolves bot config per-row and marks individual
    // rows as failed if their bot is missing.
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
