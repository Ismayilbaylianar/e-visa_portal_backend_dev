import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * 3-hour payment-window timeout sweep.
 *
 * Mirrors the TelegramNotificationService pattern: no `@nestjs/schedule`
 * dependency, just `OnModuleInit` + `setInterval`. PM2 runs a single
 * fork instance, so the interval never double-fires; if the deployment
 * ever moves to cluster mode this would need a leader-election guard.
 *
 * Every 10 minutes `sweep()` runs two passes over UNPAID, not-deleted
 * applications, keying entirely off LOCAL status — the payment webhook
 * keeps `currentStatus` authoritative (a PAID callback moves
 * UNPAID→SUBMITTED), so a paid application has already left the target
 * set. The job NEVER calls the payment gateway and NEVER hard-deletes.
 *
 *   1. Warning pass — deadline within the next hour, warning not yet
 *      sent: send `payment.window.warning`, then stamp
 *      `paymentWarningSentAt` so the next sweep skips it. The stamp is
 *      written even when the email is a dev no-op, so we never re-send.
 *   2. Expiry pass — deadline already passed: soft-delete (set
 *      `deletedAt`) + mark `expiredReason = 'PAYMENT_WINDOW_EXPIRED'`,
 *      then send `payment.window.expired`. Child rows (applicants,
 *      payments, documents) stay intact — cascade only fires on hard
 *      delete.
 *
 * Each row is wrapped in try/catch so one bad record can't abort the
 * whole sweep; a concise summary (warned / expired counts) is logged
 * per run.
 */

const EXPIRED_REASON = 'PAYMENT_WINDOW_EXPIRED';
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const INITIAL_DELAY_MS = 30 * 1000; // first sweep ~30s after boot
const WARNING_WINDOW_MS = 60 * 60 * 1000; // warn within 1h of deadline
const SWEEP_BATCH = 200; // safety cap per pass per sweep

@Injectable()
export class PaymentTimeoutService implements OnModuleInit {
  private readonly logger = new Logger(PaymentTimeoutService.name);
  private sweepTimer?: NodeJS.Timeout;
  private initialTimer?: NodeJS.Timeout;
  /** Guards against overlapping sweeps if one run outlives the interval. */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // One sweep shortly after boot (catches anything that expired while
    // the process was down), then every 10 minutes.
    this.initialTimer = setTimeout(() => {
      this.sweep().catch((e) =>
        this.logger.error(`Initial payment-timeout sweep failed: ${this.fmt(e)}`),
      );
    }, INITIAL_DELAY_MS);

    this.sweepTimer = setInterval(() => {
      this.sweep().catch((e) =>
        this.logger.error(`Payment-timeout sweep failed: ${this.fmt(e)}`),
      );
    }, SWEEP_INTERVAL_MS);

    this.logger.log(
      `Payment-timeout sweep scheduled — every ${SWEEP_INTERVAL_MS / 60000}m (first run in ${INITIAL_DELAY_MS / 1000}s)`,
    );
  }

  /**
   * One full sweep: warning pass then expiry pass. Idempotent and safe
   * to run as often as the interval fires.
   */
  async sweep(): Promise<{ warned: number; expired: number }> {
    if (this.running) {
      this.logger.debug('Payment-timeout sweep already in progress — skipping tick');
      return { warned: 0, expired: 0 };
    }
    this.running = true;
    const now = new Date();
    let warned = 0;
    let expired = 0;
    try {
      warned = await this.warningPass(now);
      expired = await this.expiryPass(now);
      if (warned > 0 || expired > 0) {
        this.logger.log(
          `Payment-timeout sweep: warned ${warned}, expired ${expired}`,
        );
      } else {
        this.logger.debug('Payment-timeout sweep: nothing to do');
      }
    } finally {
      this.running = false;
    }
    return { warned, expired };
  }

  /**
   * Warning pass — UNPAID apps whose deadline is within the next hour
   * and that haven't been warned yet.
   */
  private async warningPass(now: Date): Promise<number> {
    const horizon = new Date(now.getTime() + WARNING_WINDOW_MS);
    const due = await this.prisma.application.findMany({
      where: {
        currentStatus: ApplicationStatus.UNPAID,
        deletedAt: null,
        paymentWarningSentAt: null,
        paymentDeadlineAt: { gte: now, lte: horizon },
      },
      include: this.recipientInclude(),
      take: SWEEP_BATCH,
    });

    let count = 0;
    for (const app of due) {
      try {
        // Stamp FIRST so a transient email failure can't cause the next
        // sweep to re-send. The send is best-effort below.
        await this.prisma.application.update({
          where: { id: app.id },
          data: { paymentWarningSentAt: new Date() },
        });
        await this.send(app, 'payment.window.warning');
        count += 1;
      } catch (e) {
        this.logger.warn(
          `Warning pass failed for application ${app.id}: ${this.fmt(e)}`,
        );
      }
    }
    return count;
  }

  /**
   * Expiry pass — UNPAID apps already past their deadline. Soft-delete +
   * mark, then send the cancellation email.
   */
  private async expiryPass(now: Date): Promise<number> {
    const overdue = await this.prisma.application.findMany({
      where: {
        currentStatus: ApplicationStatus.UNPAID,
        deletedAt: null,
        paymentDeadlineAt: { lt: now },
      },
      include: this.recipientInclude(),
      take: SWEEP_BATCH,
    });

    let count = 0;
    for (const app of overdue) {
      try {
        await this.prisma.application.update({
          where: { id: app.id },
          data: {
            deletedAt: new Date(),
            expiredReason: EXPIRED_REASON,
            // Reflect the cancellation on the payment dimension too so
            // admin reports don't show a "PENDING" payment on a
            // cancelled application. Harmless — the row is soft-deleted.
            paymentStatus: PaymentStatus.EXPIRED,
          },
        });
        await this.send(app, 'payment.window.expired');
        count += 1;
      } catch (e) {
        this.logger.warn(
          `Expiry pass failed for application ${app.id}: ${this.fmt(e)}`,
        );
      }
    }
    return count;
  }

  // ===========================================================
  // Helpers
  // ===========================================================

  private recipientInclude() {
    return {
      portalIdentity: true,
      destinationCountry: true,
      visaType: true,
      applicants: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  /**
   * Build the recipient list + variable bag and fire the templated
   * email. Best-effort: on dev `EMAIL_PROVIDER` is empty so this is a
   * no-op that still writes an email_logs row. Never throws — failures
   * are logged by the caller's try/catch but shouldn't block the DB
   * state change that already happened.
   */
  private async send(app: any, templateKey: string): Promise<void> {
    const recipients = new Set<string>();
    if (app.portalIdentity?.email) {
      recipients.add(String(app.portalIdentity.email).toLowerCase().trim());
    }
    for (const ap of app.applicants ?? []) {
      if (ap.email) recipients.add(String(ap.email).toLowerCase().trim());
    }
    if (recipients.size === 0) {
      this.logger.debug(`No recipient for application ${app.id} — skipping ${templateKey}`);
      return;
    }

    const main =
      (app.applicants ?? []).find((a: any) => a.isMainApplicant) ??
      (app.applicants ?? [])[0];
    const mainForm = (main?.formDataJson ?? {}) as Record<string, unknown>;
    const firstName = String(mainForm.firstName ?? '').trim();
    const lastName = String(mainForm.lastName ?? '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Applicant';
    const applicationCode =
      app.referenceCode ?? main?.applicationCode ?? app.id;

    const baseUrl = (
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('PUBLIC_BASE_URL') ??
      'https://evisaglobal.com'
    ).replace(/\/+$/, '');
    // Warning → resume the in-flight application; expired → start fresh.
    const ctaUrl =
      templateKey === 'payment.window.warning' && app.resumeToken
        ? `${baseUrl}/resume/${encodeURIComponent(app.resumeToken)}`
        : `${baseUrl}/`;

    const deadlineAt = app.paymentDeadlineAt
      ? new Date(app.paymentDeadlineAt).toISOString()
      : '';

    const variables = {
      fullName,
      firstName,
      lastName,
      applicationCode,
      applicationRef: applicationCode,
      referenceCode: app.referenceCode ?? '',
      destinationCountry: app.destinationCountry?.name ?? '',
      visaType: app.visaType?.label ?? '',
      deadlineAt,
      ctaUrl,
      supportEmail:
        this.configService.get<string>('SUPPORT_EMAIL') ?? 'support@evisaglobal.com',
    };

    for (const to of recipients) {
      const result = await this.emailService.sendTemplatedEmail({
        to,
        templateKey,
        variables: { ...variables, email: to },
        relatedEntity: 'Application',
        relatedEntityId: app.id,
      });
      this.logger.log(
        `payment-timeout email ${templateKey} → ${to} for ${applicationCode}: ${result.success ? 'ok' : 'fail(' + (result.error ?? 'noop') + ')'}`,
      );
    }
  }

  private fmt(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
