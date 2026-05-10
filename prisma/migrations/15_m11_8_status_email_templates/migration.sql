-- M11.8 (ISSUE 8 EXT) — Rebuild status + transactional email templates.
--
-- Anar deliberately deleted the original 10 templates because they
-- were poorly written. This migration ships fresh, well-structured
-- replacements modelled on the working `admin_password_reset`
-- template (header bar, white card, branded CTA, gray footer).
--
-- Idempotency: ON CONFLICT (template_key) DO UPDATE SET ... so this
-- migration is the canonical source of truth for system template
-- content. If anyone (including Anar) edits a system template in
-- admin and we want to roll the canonical version forward, bump the
-- migration body and re-deploy — Postgres will refresh.
--
-- The DELETE at the bottom removes the leftover 'hey' junk template.
--
-- Variables exposed by the application service when sending these:
--   {{fullName}}            — main applicant first + last name
--   {{applicationCode}}     — APP-YYYY-NNNNNN (the canonical code,
--                             NOT the UUID slice that was leaking)
--   {{applicationStatus}}   — human label e.g. "Approved"
--   {{destinationCountry}}  — destination country name
--   {{visaType}}            — visa type label
--   {{ctaUrl}}              — link to /me on the public site

BEGIN;

-- application.created — sent on application creation (pre-payment)
INSERT INTO email_templates (
  id, template_key, subject, body_html, body_text, is_active, description,
  created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'application.created',
  'Your visa application has been created — {{applicationCode}}',
  $html$<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Application created</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Application created</h1>
          <p>Hi {{fullName}},</p>
          <p>Your visa application for <strong>{{destinationCountry}}</strong> ({{visaType}}) has been created. Save this reference number — you'll need it to track your application or resume the form later.</p>
          <p style="background-color:#f3f4f6;border-left:4px solid #1e40af;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;">
            <strong>{{applicationCode}}</strong>
          </p>
          <p>Next step: complete payment to submit your application for review.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Continue application</a>
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

Your visa application for {{destinationCountry}} ({{visaType}}) has been created.

Reference: {{applicationCode}}

Next step: complete payment to submit your application for review.
Continue: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when an application is first created (pre-payment).',
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

-- application.submitted — payment complete, awaiting admin review
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.submitted',
  'Application submitted — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Application submitted</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Application submitted</h1>
<p>Hi {{fullName}},</p>
<p>Your application for <strong>{{destinationCountry}}</strong> ({{visaType}}) has been submitted and is now in review.</p>
<p style="background-color:#f3f4f6;border-left:4px solid #1e40af;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p>You'll get a follow-up email once a decision is made or if any additional documents are needed.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Track application</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Your application for {{destinationCountry}} ({{visaType}}) has been submitted and is now in review.

Reference: {{applicationCode}}

You'll get a follow-up email once a decision is made or if any additional documents are needed.
Track: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent after payment when the application enters admin review queue.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- application.approved
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.approved',
  'Visa application approved — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Application approved</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#047857;">Visa approved 🎉</h1>
<p>Hi {{fullName}},</p>
<p>Great news — your visa application for <strong>{{destinationCountry}}</strong> ({{visaType}}) has been <strong>approved</strong>.</p>
<p style="background-color:#f3f4f6;border-left:4px solid #047857;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p>Your visa document is being prepared and will be available for download in your portal shortly. We'll send a follow-up email when the file is ready.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#047857;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Open your portal</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Great news — your visa application for {{destinationCountry}} ({{visaType}}) has been approved.

Reference: {{applicationCode}}

Your visa document is being prepared and will be available for download in your portal shortly.
Portal: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when admin approves an application.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- application.rejected — uses {{notes}} for the rejection reason
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.rejected',
  'Application status update — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Application status</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Application status update</h1>
<p>Hi {{fullName}},</p>
<p>Your visa application for <strong>{{destinationCountry}}</strong> ({{visaType}}) has been reviewed and unfortunately could not be approved at this time.</p>
<p style="background-color:#f3f4f6;border-left:4px solid #b91c1c;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p><strong>Reason:</strong></p>
<p style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;color:#7f1d1d;">{{notes}}</p>
<p>If you'd like to discuss the decision or submit a fresh application, please contact our support team.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Open your portal</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Your visa application for {{destinationCountry}} ({{visaType}}) has been reviewed and unfortunately could not be approved at this time.

Reference: {{applicationCode}}

Reason: {{notes}}

If you'd like to discuss the decision or submit a fresh application, please contact support@evisaglobal.com.
Portal: {{ctaUrl}}$txt$,
  true,
  'Sent when admin rejects an application. {{notes}} carries the reason text.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- application.need_docs
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.need_docs',
  'Additional documents required — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Documents required</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#b45309;">Additional documents required</h1>
<p>Hi {{fullName}},</p>
<p>Our review team needs additional documents to continue processing your application for <strong>{{destinationCountry}}</strong> ({{visaType}}).</p>
<p style="background-color:#f3f4f6;border-left:4px solid #b45309;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p><strong>What we need:</strong></p>
<p style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;color:#78350f;">{{notes}}</p>
<p>Please open your portal to upload the requested documents — review will resume as soon as they're received.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#b45309;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Upload documents</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Our review team needs additional documents to continue processing your application for {{destinationCountry}} ({{visaType}}).

Reference: {{applicationCode}}

What we need: {{notes}}

Open your portal to upload the requested documents:
{{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when admin requests additional documents. {{notes}} carries the request detail.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- application.ready_to_download
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.ready_to_download',
  'Your visa is ready — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Visa ready</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#047857;">Your visa is ready</h1>
<p>Hi {{fullName}},</p>
<p>Your visa for <strong>{{destinationCountry}}</strong> ({{visaType}}) is ready to download from your portal.</p>
<p style="background-color:#f3f4f6;border-left:4px solid #047857;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p>Print a copy and travel with it. Most border officers want to see the document on paper as well as a digital copy on your phone.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#047857;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Download visa</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Safe travels! <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Your visa for {{destinationCountry}} ({{visaType}}) is ready to download.

Reference: {{applicationCode}}

Open your portal: {{ctaUrl}}

Print a copy — most border officers want to see the document on paper as well as a digital copy on your phone.

Safe travels! — support@evisaglobal.com$txt$,
  true,
  'Sent when the issued visa file is uploaded by admin and ready for the customer to download.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- application.documents.resubmitted — confirms receipt of new uploads
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'application.documents.resubmitted',
  'Documents received — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Documents received</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Documents received</h1>
<p>Hi {{fullName}},</p>
<p>We've received the documents you uploaded for application <strong>{{applicationCode}}</strong> and your case is back in the review queue.</p>
<p>You'll get another email as soon as a decision is made or if anything else is needed. Typical re-review takes 1–3 business days.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Track application</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

We've received the documents you uploaded for application {{applicationCode}} and your case is back in the review queue.

You'll get another email as soon as a decision is made or if anything else is needed. Typical re-review takes 1-3 business days.

Track: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Confirmation that resubmitted documents arrived and the case re-entered review.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- payment.success
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'payment.success',
  'Payment received — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Payment received</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#047857;">Payment received</h1>
<p>Hi {{fullName}},</p>
<p>Thanks — your payment has been received and your application for <strong>{{destinationCountry}}</strong> ({{visaType}}) is now in the review queue.</p>
<p style="background-color:#f3f4f6;border-left:4px solid #047857;padding:12px 16px;font-family:monospace;font-size:16px;color:#0f172a;"><strong>{{applicationCode}}</strong></p>
<p>You'll get a follow-up email as soon as a decision is made.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Track application</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

Thanks — your payment has been received and your application for {{destinationCountry}} ({{visaType}}) is now in the review queue.

Reference: {{applicationCode}}

Track: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when a payment for an application succeeds.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- otp.send — variables: {{otpCode}}, {{expiresInMinutes}}
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'otp.send',
  'Your verification code',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Verification code</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Your verification code</h1>
<p>Use this one-time code to continue:</p>
<p style="text-align:center;margin:24px 0;">
<span style="display:inline-block;background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:16px 24px;font-family:monospace;font-size:28px;font-weight:600;letter-spacing:8px;color:#0f172a;">{{otpCode}}</span>
</p>
<p style="font-size:13px;color:#6b7280;">This code expires in <strong>{{expiresInMinutes}} minutes</strong> and can only be used once. If you didn't request it, you can safely ignore this email.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Your verification code: {{otpCode}}

This code expires in {{expiresInMinutes}} minutes and can only be used once.

If you didn't request it, ignore this email.$txt$,
  true,
  'Customer-portal OTP login code (one-time, time-bounded).',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- document_upload_received
INSERT INTO email_templates (id, template_key, subject, body_html, body_text, is_active, description, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'document_upload_received',
  'Document upload confirmed — {{applicationCode}}',
  $html$<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Upload confirmed</title></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0f172a;padding:20px 32px;text-align:center;"><span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.5px;">E-VISA GLOBAL</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.55;color:#1f2937;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">Document received</h1>
<p>Hi {{fullName}},</p>
<p>We've received your document upload for application <strong>{{applicationCode}}</strong>. Our review team will look it over and follow up if anything else is needed.</p>
<p style="text-align:center;margin:24px 0;">
<a href="{{ctaUrl}}" style="display:inline-block;background-color:#1e40af;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">View application</a>
</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">Need help? <a href="mailto:support@evisaglobal.com" style="color:#2563eb;text-decoration:none;">support@evisaglobal.com</a></td></tr>
</table></td></tr></table></body></html>$html$,
  $txt$Hi {{fullName}},

We've received your document upload for application {{applicationCode}}. Our review team will look it over and follow up if anything else is needed.

View: {{ctaUrl}}

Need help? support@evisaglobal.com$txt$,
  true,
  'Sent when a customer uploads a new document into an existing application.',
  NOW(), NOW()
)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, body_text=EXCLUDED.body_text, description=EXCLUDED.description, is_active=true, deleted_at=NULL, updated_at=NOW();

-- Hard-delete the leftover 'hey' junk row.
DELETE FROM email_templates WHERE template_key = 'hey';

COMMIT;
