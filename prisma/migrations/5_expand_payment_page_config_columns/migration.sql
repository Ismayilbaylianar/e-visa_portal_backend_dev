-- Module 5 — PaymentPageConfig (singleton) expansion.
--
-- Adds 8 admin-facing columns covering content / layout / behavior
-- groups (matches the 3 tabs the admin UI exposes). All additive:
--   • BOOLEAN NOT NULL with sensible product defaults
--   • TEXT (nullable) for optional supportText / footerNote /
--     termsCheckboxText
--   • TEXT NOT NULL with safe default for primaryButtonText
--   • INTEGER NOT NULL for timeoutWarningMinutes (default 5 min)
--
-- No DROPs, no FK touches, no enum changes. Safe to apply on a live DB
-- (zero application risk; existing PaymentPageConfig row gets backfilled
-- to the column defaults, runtime readers tolerate nulls / defaults).
--
-- The original `sections_json` / `is_active` columns stay untouched —
-- the advanced section builder UI lives in a Sprint 4 ticket.

ALTER TABLE "payment_page_configs" ADD COLUMN "show_card_logos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "payment_page_configs" ADD COLUMN "show_security_badges" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "payment_page_configs" ADD COLUMN "support_text" TEXT;
ALTER TABLE "payment_page_configs" ADD COLUMN "footer_note" TEXT;
ALTER TABLE "payment_page_configs" ADD COLUMN "primary_button_text" TEXT NOT NULL DEFAULT 'Pay Now';
ALTER TABLE "payment_page_configs" ADD COLUMN "timeout_warning_minutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "payment_page_configs" ADD COLUMN "terms_checkbox_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payment_page_configs" ADD COLUMN "terms_checkbox_text" TEXT;
