-- 3-hour payment-window timeout job — marker columns + 2 email templates.
--
-- The timeout sweep (PaymentTimeoutService) runs every 10 minutes and:
--   • sends a "1 hour remaining" warning, stamping payment_warning_sent_at
--     so it never re-sends;
--   • soft-deletes UNPAID applications past payment_deadline_at and sets
--     expired_reason = 'PAYMENT_WINDOW_EXPIRED' so the resume endpoint can
--     surface the specific "payment window expired" message instead of a
--     generic not-found.
--
-- `applications` is owned by evisa_app (ownership reassignment done in a
-- prior sprint), so the ALTER succeeds. No backfill — both columns start
-- NULL and only the job populates them.

BEGIN;

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "payment_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expired_reason" TEXT;

-- ---------------------------------------------------------------------
-- Email template: payment.window.warning (1 hour remaining)
-- Variables (provided by PaymentTimeoutService.sweep):
--   {{fullName}} {{applicationCode}} {{destinationCountry}}
--   {{visaType}} {{deadlineAt}} {{ctaUrl}}
-- ---------------------------------------------------------------------
INSERT INTO email_templates (
  id, template_key, subject, body_html, body_text, is_active, description,
  created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'payment.window.warning',
  'Your payment window closes soon — {{applicationCode}}',
  $html$<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Payment window closing</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#b45309;">Payment window closing soon</h1>
          <p>Hi {{fullName}},</p>
          <p>Your visa application for <strong>{{destinationCountry}}</strong> ({{visaType}}) is complete but not yet paid. Your payment window closes in about <strong>1 hour</strong>.</p>
          <p style="background-color:#fef3c7;border-left:4px solid #b45309;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;">
            <strong>{{applicationCode}}</strong><br/>
            <span style="font-size:13px;color:#92400e;">Pay before {{deadlineAt}}</span>
          </p>
          <p>Complete payment now to keep your application — once the window closes it will be cancelled and you'll need to start a new one.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="{{ctaUrl}}" style="display:inline-block;background-color:#b45309;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Complete payment</a>
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>$html$,
  $txt$Hi {{fullName}},

Your visa application for {{destinationCountry}} ({{visaType}}) is complete but not yet paid. Your payment window closes in about 1 hour.

Reference: {{applicationCode}}
Pay before: {{deadlineAt}}

Complete payment now to keep your application — once the window closes it will be cancelled and you'll need to start a new one.

Complete payment: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent ~1 hour before an unpaid application''s 3-hour payment window closes.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_active = true,
  deleted_at = NULL,
  updated_at = NOW();

-- ---------------------------------------------------------------------
-- Email template: payment.window.expired (cancelled after timeout)
-- Variables: {{fullName}} {{applicationCode}} {{destinationCountry}}
--            {{visaType}} {{ctaUrl}}
-- ---------------------------------------------------------------------
INSERT INTO email_templates (
  id, template_key, subject, body_html, body_text, is_active, description,
  created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'payment.window.expired',
  'Your application was cancelled — payment window expired',
  $html$<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Payment window expired</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#b91c1c;">Application cancelled</h1>
          <p>Hi {{fullName}},</p>
          <p>Your visa application for <strong>{{destinationCountry}}</strong> ({{visaType}}) was not paid within the 3-hour payment window, so it has been cancelled.</p>
          <p style="background-color:#fee2e2;border-left:4px solid #b91c1c;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;">
            <strong>{{applicationCode}}</strong>
          </p>
          <p>No charge was made. You can start a fresh application whenever you're ready.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Start a new application</a>
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>$html$,
  $txt$Hi {{fullName}},

Your visa application for {{destinationCountry}} ({{visaType}}) was not paid within the 3-hour payment window, so it has been cancelled.

Reference: {{applicationCode}}

No charge was made. You can start a fresh application whenever you're ready.

Start a new application: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when the timeout sweep cancels (soft-deletes) an unpaid application past its 3-hour window.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_active = true,
  deleted_at = NULL,
  updated_at = NOW();

COMMIT;
