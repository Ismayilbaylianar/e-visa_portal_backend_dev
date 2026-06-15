-- Entries feature (Stage 1) — visa-type entries + per-entry binding fees.
--
-- VisaType collapses to 1 row per purpose; validity / max-stay / entry
-- label move to a new `visa_type_entries` table (free-string label →
-- supports admin CUSTOM entries; the VisaEntryType enum is dropped).
-- Pricing becomes per-(binding, nationality, entry): binding_nationality_fees
-- gains entry_id and its UNIQUE becomes the 3-column key.
--
-- All current visa/binding/application data is disposable test data
-- (owner-approved clean slate), so we wipe in FK-dependency order
-- before the destructive schema changes. visa_types is referenced by
-- template_bindings.visa_type_id and applications.visa_type_id (both
-- ON DELETE RESTRICT), so those trees must go first.
--
-- All affected tables are owned by evisa_app (ownership reassignment
-- done in an earlier sprint), so every ALTER/DROP succeeds.

BEGIN;

-- 1. FK-safe wipe (children → parents). payments.application_id and
--    applications.template_binding_id are ON DELETE RESTRICT; everything
--    else under them cascades. Order: payments → applications →
--    binding_nationality_fees → template_bindings → visa_types.
DELETE FROM "payments";
DELETE FROM "applications";
DELETE FROM "binding_nationality_fees";
DELETE FROM "template_bindings";
DELETE FROM "visa_types";

-- 2. New per-entry table.
CREATE TABLE IF NOT EXISTS "visa_type_entries" (
  "id"            TEXT NOT NULL,
  "visa_type_id"  TEXT NOT NULL,
  "entry_label"   TEXT NOT NULL,
  "entry_key"     TEXT,
  "validity_days" INTEGER NOT NULL,
  "max_stay_days" INTEGER NOT NULL,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  "deleted_at"    TIMESTAMP(3),
  CONSTRAINT "visa_type_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "visa_type_entries"
  ADD CONSTRAINT "visa_type_entries_visa_type_id_fkey"
  FOREIGN KEY ("visa_type_id") REFERENCES "visa_types"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "visa_type_entries"
  ADD CONSTRAINT "visa_type_entries_durations_ck"
  CHECK ("validity_days" >= 1 AND "max_stay_days" >= 1 AND "max_stay_days" <= "validity_days");

CREATE INDEX IF NOT EXISTS "visa_type_entries_visa_type_id_idx" ON "visa_type_entries"("visa_type_id");
CREATE INDEX IF NOT EXISTS "visa_type_entries_sort_order_idx" ON "visa_type_entries"("sort_order");
CREATE INDEX IF NOT EXISTS "visa_type_entries_is_active_idx" ON "visa_type_entries"("is_active");
CREATE INDEX IF NOT EXISTS "visa_type_entries_deleted_at_idx" ON "visa_type_entries"("deleted_at");

-- 3. Drop the flat visa-type columns (now per-entry), then the enum.
--    The `entries` column must go before the enum type it uses.
ALTER TABLE "visa_types" DROP COLUMN IF EXISTS "entries";
ALTER TABLE "visa_types" DROP COLUMN IF EXISTS "validity_days";
ALTER TABLE "visa_types" DROP COLUMN IF EXISTS "max_stay";
DROP TYPE IF EXISTS "VisaEntryType";

-- 4. Per-entry fee dimension. The table was wiped above, so adding a
--    NOT NULL column with an FK is safe. Swap the 2-column UNIQUE index
--    for the 3-column one.
ALTER TABLE "binding_nationality_fees"
  ADD COLUMN "entry_id" TEXT NOT NULL;

ALTER TABLE "binding_nationality_fees"
  ADD CONSTRAINT "binding_nationality_fees_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "visa_type_entries"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

DROP INDEX IF EXISTS "binding_nationality_fees_template_binding_id_nationality_co_key";
CREATE UNIQUE INDEX "binding_nationality_fees_tb_nat_entry_key"
  ON "binding_nationality_fees"("template_binding_id", "nationality_country_id", "entry_id");
CREATE INDEX IF NOT EXISTS "binding_nationality_fees_entry_id_idx"
  ON "binding_nationality_fees"("entry_id");

-- The processing_days + expedited CHECKs from migration 28 remain
-- valid per fee row (they're scoped to the row, which is now per entry).

COMMIT;
