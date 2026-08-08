-- Stage 3 / Steps 2+3 — first-decision email templates.
--
--   application.processing_started — operator ACCEPTED: funds captured,
--                                    the visa is being prepared.
--   application.cancelled          — operator found a disqualifying
--                                    issue: ALL funds released, nothing
--                                    charged, and the customer is invited
--                                    to submit a new application.
--
-- Idempotent (ON CONFLICT DO UPDATE), so the canonical content re-applies
-- on every deploy — same mechanism as migration 15 / 30. Variables come
-- from sendStatusNotificationEmail: fullName, applicationCode,
-- destinationCountry, visaType, ctaUrl, notes, processingDays.

INSERT INTO email_templates (
  id, template_key, subject, body_html, body_text, is_active, description,
  created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'application.processing_started',
  'We''ve started processing your visa — {{applicationCode}}',
  $html$<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Processing started</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#1d4ed8;">Your visa is being prepared</h1>
          <p>Hi {{fullName}},</p>
          <p>Good news — we&rsquo;ve accepted your application for <strong>{{destinationCountry}}</strong> ({{visaType}}) and started preparing your visa. Your payment has now been processed.</p>
          <p style="background-color:#eff6ff;border-left:4px solid #1d4ed8;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;">
            <strong>{{applicationCode}}</strong>
          </p>
          <p>We&rsquo;ll email you again as soon as your visa is ready to download. No action is needed from you right now.</p>
          <p>{{notes}}</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="{{ctaUrl}}" style="display:inline-block;background-color:#1d4ed8;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Track your application</a>
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  $text$Hi {{fullName}},

Good news - we have accepted your application for {{destinationCountry}} ({{visaType}}) and started preparing your visa. Your payment has now been processed.

Application: {{applicationCode}}

We will email you again as soon as your visa is ready to download. No action is needed right now.

{{notes}}

Track your application: {{ctaUrl}}

Need help? support@evisaglobal.com$text$,
  true,
  'Stage 3 — sent when an operator accepts an application: payment captured, application moves to PROCESSING.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET
  subject     = EXCLUDED.subject,
  body_html   = EXCLUDED.body_html,
  body_text   = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_active   = true,
  deleted_at  = NULL,
  updated_at  = NOW();

INSERT INTO email_templates (
  id, template_key, subject, body_html, body_text, is_active, description,
  created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'application.cancelled',
  'Your application could not be processed — {{applicationCode}}',
  $html$<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Application cancelled</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#b91c1c;">We couldn&rsquo;t process this application</h1>
          <p>Hi {{fullName}},</p>
          <p>We reviewed your application for <strong>{{destinationCountry}}</strong> ({{visaType}}) and found an issue that prevents us from processing it.</p>
          <p style="background-color:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;color:#0f172a;">
            <strong>Reason:</strong><br/>{{notes}}
          </p>
          <p style="background-color:#ecfdf5;border-left:4px solid #059669;padding:12px 16px;color:#065f46;">
            <strong>You have not been charged.</strong> The full amount held on your card has been released. Depending on your bank it can take a few business days to disappear from your statement.
          </p>
          <p>You&rsquo;re welcome to correct the issue above and submit a <strong>new application</strong> — this one can&rsquo;t be reopened.</p>
          <p style="font-family:monospace;font-size:14px;color:#6b7280;">Reference: {{applicationCode}}</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="{{ctaUrl}}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Start a new application</a>
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  $text$Hi {{fullName}},

We reviewed your application for {{destinationCountry}} ({{visaType}}) and found an issue that prevents us from processing it.

Reason:
{{notes}}

You have NOT been charged. The full amount held on your card has been released; depending on your bank it can take a few business days to disappear from your statement.

You are welcome to correct the issue and submit a NEW application - this one cannot be reopened.

Reference: {{applicationCode}}
Start a new application: {{ctaUrl}}

Need help? support@evisaglobal.com$text$,
  true,
  'Stage 3 — sent when an operator cancels an application at the first decision: authorization released in full, nothing charged.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET
  subject     = EXCLUDED.subject,
  body_html   = EXCLUDED.body_html,
  body_text   = EXCLUDED.body_text,
  description = EXCLUDED.description,
  is_active   = true,
  deleted_at  = NULL,
  updated_at  = NOW();
