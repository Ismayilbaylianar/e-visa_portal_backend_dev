-- Flip-binding-flow — Destination-envelope refactor.
--
-- We are flipping the bulk-binding editor's axes: the envelope becomes
-- (destination, visa_type) and each row becomes one nationality. The
-- existing DB keys already support this — `template_bindings` is
-- already keyed on (destination_country_id, visa_type_id), and
-- `binding_nationality_fees` is already per-nationality. What changes
-- is which columns carry the "processing days" rule.
--
-- Old model:
--   template_bindings.processing_time_min   (M11.14 BUG OO range,
--   template_bindings.processing_time_max    per binding)
--   template_bindings.min_arrival_days_advance (M11.3 per binding)
--
-- New model:
--   binding_nationality_fees.processing_days           (NOT NULL DEFAULT 3)
--   binding_nationality_fees.expedited_processing_days (NULL)
--   binding_nationality_fees CHECK constraint: when expedited_enabled
--     is true, expedited_processing_days must be set AND strictly less
--     than processing_days. The brief calls this out as the per-row
--     rule the bulk editor enforces inline.
--
-- The brief explicitly says the old binding rows are test data and may
-- be deleted, so this migration wipes the relevant rows before dropping
-- the now-unused columns.

BEGIN;

-- 1. Wipe existing test rows in FK-dependency order. The original cut
--    of this migration deleted only fees + bindings and got blocked by
--    `applications.template_binding_id_fkey` (ON DELETE RESTRICT) —
--    the dev clone carries 10 application rows pointing at bindings.
--    Owner approved a wider clean slate for both dev + prod since all
--    of this is test data, so we wipe the application + payment trees
--    first. CASCADE handles the descendant rows automatically:
--      * payments      → payment_callbacks, payment_reconciliations,
--                         payment_status_history, payment_transactions
--      * applications  → application_applicants,
--                         application_assignment_history,
--                         application_estimated_time_changes,
--                         application_internal_notes,
--                         application_result_files,
--                         application_status_history,
--                         document_requests
--    Order matters:
--      payments.application_id is ON DELETE RESTRICT, so payments
--      must be wiped before applications. applications.template_binding_id
--      is ON DELETE RESTRICT, so applications must be wiped before
--      template_bindings. binding_nationality_fees.template_binding_id
--      is ON DELETE CASCADE, but we delete it explicitly anyway so the
--      step is visible in this migration.
DELETE FROM "payments";
DELETE FROM "applications";
DELETE FROM "binding_nationality_fees";
DELETE FROM "template_bindings";

-- 2. Drop the M11.14 / M11.3 columns + CHECK that are being replaced.
ALTER TABLE "template_bindings" DROP CONSTRAINT IF EXISTS "template_bindings_processing_window_ck";
ALTER TABLE "template_bindings" DROP COLUMN IF EXISTS "processing_time_min";
ALTER TABLE "template_bindings" DROP COLUMN IF EXISTS "processing_time_max";
ALTER TABLE "template_bindings" DROP COLUMN IF EXISTS "min_arrival_days_advance";

-- 3. Per-nationality processing days. NOT NULL with default 3 matches
--    the brief's "optional, default 3" UX rule — the row always carries
--    a value, even if the admin never edited it.
ALTER TABLE "binding_nationality_fees"
  ADD COLUMN "processing_days" INT NOT NULL DEFAULT 3;
ALTER TABLE "binding_nationality_fees"
  ADD COLUMN "expedited_processing_days" INT;

-- 4. CHECK constraint mirrors the inline UI rule:
--      expedited_enabled = false  →  expedited_processing_days irrelevant
--      expedited_enabled = true   →  expedited_processing_days IS NOT NULL
--                                   AND expedited_processing_days < processing_days
--    Plus a sanity floor that processing_days must be ≥ 1 (the brief's
--    default is 3, real-world bindings would never use 0).
ALTER TABLE "binding_nationality_fees"
  ADD CONSTRAINT "binding_nationality_fees_processing_days_ck"
  CHECK ("processing_days" >= 1);

ALTER TABLE "binding_nationality_fees"
  ADD CONSTRAINT "binding_nationality_fees_expedited_days_ck"
  CHECK (
    "expedited_enabled" = false OR (
      "expedited_processing_days" IS NOT NULL
      AND "expedited_processing_days" >= 1
      AND "expedited_processing_days" < "processing_days"
    )
  );

COMMIT;
