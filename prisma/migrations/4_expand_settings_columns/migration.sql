-- Module 4 — Settings (singleton) expansion.
--
-- Adds 13 admin-facing fields to the settings singleton so the admin UI
-- can edit the full surface area defined in the spec (general + payment
-- + email + application + maintenance + branding + legal). All columns
-- are additive:
--   • TEXT NOT NULL with safe '' default for required string fields →
--     existing row gets backfilled to empty string, no broken FK refs
--   • TEXT (nullable) for optional URL/string fields
--   • BOOLEAN NOT NULL with sensible product default
--   • INTEGER NOT NULL with product default
--
-- No DROPs, no FK touches, no enum changes. Safe to apply on a live DB
-- (zero application risk; readers tolerate '' / NULL until admin saves).
--
-- Runtime cutover for SMTP-from fields and applicationCodeFormat lives
-- in Sprint 5 — until then these columns are admin-editable but the
-- application still reads .env / hardcoded format at runtime.

ALTER TABLE "settings" ADD COLUMN "site_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "application_code_format" TEXT NOT NULL DEFAULT 'EV-{YYYY}-{NNNN}';
ALTER TABLE "settings" ADD COLUMN "max_applicants_per_application" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "settings" ADD COLUMN "allow_multiple_visa_types" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "notification_email_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "smtp_from_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "smtp_from_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "maintenance_message" TEXT;
ALTER TABLE "settings" ADD COLUMN "terms_url" TEXT;
ALTER TABLE "settings" ADD COLUMN "privacy_url" TEXT;
ALTER TABLE "settings" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "settings" ADD COLUMN "favicon_url" TEXT;
ALTER TABLE "settings" ADD COLUMN "google_analytics_id" TEXT;
