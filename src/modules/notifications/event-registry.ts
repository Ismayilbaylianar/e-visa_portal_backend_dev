/**
 * M11.5 — Single source of truth for the notification event catalog.
 *
 * Each entry pairs an event key with:
 *   - channel: which Telegram channel + DB severity bucket
 *   - defaultEnabled: whether the seed turns it on out of the box
 *   - description: human-facing copy used in /admin/settings tabs
 *   - render: pure function returning { title, body } from a context
 *
 * Adding a new event = add a row here + emit it where the business
 * action happens. No other wiring needed — the seed picks it up the
 * next time it runs, and the admin Settings page renders the toggle
 * automatically.
 */

export type EventChannel = 'alerts' | 'activity';
export type EventSeverity = 'alert' | 'activity';

export interface RenderedNotification {
  title: string;
  body: string;
}

export interface EventSpec {
  channel: EventChannel;
  severity: EventSeverity;
  defaultEnabled: boolean;
  description: string;
  /** Pure render — no side effects, no I/O. */
  render: (ctx: Record<string, any>) => RenderedNotification;
}

const a = (s: any) => (s == null || s === '' ? '?' : String(s));

export const EVENT_REGISTRY: Record<string, EventSpec> = {
  // ─── ALERTS channel ─────────────────────────────────────────────
  'system.error_5xx': {
    channel: 'alerts',
    severity: 'alert',
    defaultEnabled: true,
    description: 'HTTP 5xx server error',
    render: (ctx) => ({
      title: `5xx Error: ${a(ctx.method)} ${a(ctx.path)}`,
      body:
        `Status ${a(ctx.status)} on ${a(ctx.path)}\n` +
        `Error: ${a(ctx.message)}\n` +
        `Request ID: ${a(ctx.requestId)}\n` +
        `User: ${a(ctx.userId ?? 'anonymous')}\n` +
        `IP: ${a(ctx.ip)}`,
    }),
  },
  'payment.failed': {
    channel: 'alerts',
    severity: 'alert',
    defaultEnabled: true,
    description: 'Payment processing failed',
    render: (ctx) => ({
      title: 'Payment Failed',
      body:
        `Payment: ${a(ctx.paymentReference)}\n` +
        `Application: ${a(ctx.applicationCode ?? ctx.applicationId)}\n` +
        `Amount: ${a(ctx.amount)} ${a(ctx.currency)}\n` +
        `Reason: ${a(ctx.reason)}`,
    }),
  },
  'auth.login_failed_repeated': {
    channel: 'alerts',
    severity: 'alert',
    defaultEnabled: true,
    description: 'Repeated login failures (possible brute force)',
    render: (ctx) => ({
      title: 'Possible Brute Force Attempt',
      body:
        `Email: ${a(ctx.email)}\n` +
        `IP: ${a(ctx.ip)}\n` +
        `Failed attempts: ${a(ctx.attemptCount)} in ${a(ctx.windowMinutes)} min\n` +
        `User-Agent: ${a(ctx.userAgent)}`,
    }),
  },
  'db.error': {
    channel: 'alerts',
    severity: 'alert',
    defaultEnabled: true,
    description: 'Database error',
    render: (ctx) => ({
      title: 'Database Error',
      body: `Operation: ${a(ctx.operation)}\nError: ${a(ctx.message)}`,
    }),
  },
  'health.check_failed': {
    channel: 'alerts',
    severity: 'alert',
    defaultEnabled: true,
    description: 'Health check failure',
    render: (ctx) => ({
      title: 'Health Check Failed',
      body: `Service: ${a(ctx.service)}\nReason: ${a(ctx.reason)}`,
    }),
  },

  // ─── ACTIVITY channel ───────────────────────────────────────────
  'app.submitted': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'New application submitted for review',
    render: (ctx) => ({
      title: `New Application: ${a(ctx.applicationCode ?? ctx.applicationId)}`,
      body:
        `From: ${a(ctx.email)}\n` +
        `Destination: ${a(ctx.destinationName)}\n` +
        `Visa Type: ${a(ctx.visaTypeName)}\n` +
        `Applicants: ${a(ctx.applicantCount)}\n` +
        `Total: ${a(ctx.totalAmount)} ${a(ctx.currency)}`,
    }),
  },
  'payment.received': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'Payment received',
    render: (ctx) => ({
      title: 'Payment Received',
      body:
        `Application: ${a(ctx.applicationCode ?? ctx.applicationId)}\n` +
        `Amount: ${a(ctx.amount)} ${a(ctx.currency)}\n` +
        `Provider: ${a(ctx.provider)}`,
    }),
  },
  'app.approved': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'Application approved',
    render: (ctx) => ({
      title: 'Application Approved',
      body:
        `Code: ${a(ctx.applicationCode ?? ctx.applicationId)}\n` +
        `Approver: ${a(ctx.actorName ?? ctx.actorUserId)}\n` +
        `Applicants: ${a(ctx.applicantCount)}`,
    }),
  },
  'app.rejected': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'Application rejected',
    render: (ctx) => ({
      title: 'Application Rejected',
      body:
        `Code: ${a(ctx.applicationCode ?? ctx.applicationId)}\n` +
        `Reason: ${a(ctx.reason)}\n` +
        `Rejector: ${a(ctx.actorName ?? ctx.actorUserId)}`,
    }),
  },
  'app.visa_issued': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'Visa issued (PDF uploaded for applicant)',
    render: (ctx) => ({
      title: 'Visa Issued',
      body:
        `Code: ${a(ctx.applicationCode ?? ctx.applicationId)}\n` +
        `Applicant: ${a(ctx.applicantName ?? ctx.applicantId)}\n` +
        `Issuer: ${a(ctx.actorName ?? ctx.actorUserId)}`,
    }),
  },
  'customer.registered': {
    channel: 'activity',
    severity: 'activity',
    defaultEnabled: true,
    description: 'New customer portal identity created',
    render: (ctx) => ({
      title: 'New Customer Registered',
      body: `Email: ${a(ctx.email)}\nIP: ${a(ctx.ip)}`,
    }),
  },
};

export type EventKey = keyof typeof EVENT_REGISTRY;

export const ALL_EVENT_KEYS: string[] = Object.keys(EVENT_REGISTRY);
