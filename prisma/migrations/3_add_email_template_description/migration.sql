-- Module 3 — Email Templates CRUD wiring.
--
-- Adds an optional `description` column so admins can annotate each
-- template with usage context (e.g. "Sent when user requests OTP code
-- during portal login"). Optional + nullable → safe additive change,
-- no backfill, no FK touched.

ALTER TABLE "email_templates" ADD COLUMN "description" TEXT;
