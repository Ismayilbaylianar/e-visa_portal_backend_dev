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
] as const;

export type SystemTemplateKey = (typeof SYSTEM_TEMPLATE_KEYS)[number];

export function isSystemTemplate(templateKey: string): boolean {
  return (SYSTEM_TEMPLATE_KEYS as readonly string[]).includes(templateKey);
}
