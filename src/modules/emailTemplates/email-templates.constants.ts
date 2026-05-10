/**
 * Module 3 — System template keys.
 *
 * These keys are referenced directly in `email.service.ts` as hard-coded
 * `templateKey:` literals. Soft-deleting any of them silently breaks
 * runtime emails (OTP login, application status notifications, payment
 * receipts, generic notifications, raw email fallback).
 *
 * Treated as immutable in the admin UI:
 *   - DELETE always blocked (409)
 *   - PATCH allowed for subject / bodyHtml / bodyText / description /
 *     isActive — but `templateKey` rename blocked (409)
 *
 * Single source of truth so the controller / service / response mapper
 * all agree on which rows are protected. Keep in sync with the literals
 * in `src/modules/email/email.service.ts`.
 */
export const SYSTEM_TEMPLATE_KEYS = [
  'otp_verification',
  'application_status_update',
  'generic_notification',
  'payment_confirmation',
  'raw_email',
  // M11.4 — admin forgot-password flow.
  'admin_password_reset',
  // M11.8 (ISSUE 8 EXT) — status + transactional templates rebuilt
  // from scratch via migration 15. Treated as system so the admin
  // delete-button silently no-ops on them; canonical content lives
  // in the migration and re-applies via ON CONFLICT DO UPDATE on
  // every deploy.
  'application.created',
  'application.submitted',
  'application.approved',
  'application.rejected',
  'application.need_docs',
  'application.ready_to_download',
  'application.documents.resubmitted',
  'payment.success',
  'otp.send',
  'document_upload_received',
] as const;

export type SystemTemplateKey = (typeof SYSTEM_TEMPLATE_KEYS)[number];

export function isSystemTemplate(templateKey: string): boolean {
  return (SYSTEM_TEMPLATE_KEYS as readonly string[]).includes(templateKey);
}
