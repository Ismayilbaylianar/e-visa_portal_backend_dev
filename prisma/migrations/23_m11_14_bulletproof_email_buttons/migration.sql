-- M11.14 (BUG RR) — Bulletproof button structure for status email
-- CTAs so the link survives Outlook / Apple Mail / Gmail's quirky
-- CSS stripping. The legacy <a style="display:inline-block;..."> was
-- rendered as plain text in Outlook (where inline-block on anchors
-- collapses to nothing) — customers saw the "Download visa" word
-- with no underline / no cursor pointer.
--
-- The wrapper pattern: <table> → <tr> → <td bgcolor=...> → <a> with
-- the colored fill applied to the <td>. Outlook respects bgcolor on
-- table cells but ignores it on anchors. The padding lives on the
-- anchor's display:inline-block + padding combo (which Outlook still
-- can't render but the bgcolor cell hides that) plus a fallback
-- padding on the <td>.
--
-- Idempotent: every UPDATE is keyed on the literal old markup, so
-- re-running this migration after the change has already landed is
-- a no-op (the LIKE clause won't match).

-- application.ready_to_download — the "Download visa" CTA Anar
-- reported as not clickable.
UPDATE email_templates
SET body_html = REPLACE(
  body_html,
  '<a href="{{ctaUrl}}" style="display:inline-block;background-color:#047857;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Download visa</a>',
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" bgcolor="#047857" style="background-color:#047857;border-radius:6px;"><a href="{{ctaUrl}}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;font-size:15px;border-radius:6px;">Download visa</a></td></tr></table>'
)
WHERE template_key = 'application.ready_to_download'
  AND body_html LIKE '%style="display:inline-block;background-color:#047857;color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">Download visa</a>%';

-- application.created — "Track application" / similar CTA. Update
-- any <a style="display:inline-block;..."> ctaUrl anchor into a
-- table-wrapped button. The replacement target color matches the
-- template's existing accent.
UPDATE email_templates
SET body_html = regexp_replace(
  body_html,
  '<a href="\{\{ctaUrl\}\}" style="display:inline-block;background-color:(#[0-9a-fA-F]{6});color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">([^<]+)</a>',
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" bgcolor="\1" style="background-color:\1;border-radius:6px;"><a href="{{ctaUrl}}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;font-size:15px;border-radius:6px;">\2</a></td></tr></table>',
  'g'
)
WHERE template_key IN (
  'application.created',
  'application.submitted',
  'application.approved',
  'application.rejected',
  'application.need_docs',
  'application.documents.resubmitted',
  'application.ready_to_download',
  'payment.success',
  'document_upload_received'
)
  AND body_html ~ '<a href="\{\{ctaUrl\}\}" style="display:inline-block;background-color:#[0-9a-fA-F]{6};color:#ffffff;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">';
