-- Entries feature (Stage 4) — record the chosen entry on each application.
--
-- The public cascade now has a 4th step (Entry); the customer's pick is
-- persisted on the application as `visa_type_entry_id`. Nullable for the
-- clean-slate transition (pre-existing rows pre-date the column — though
-- on dev all such rows are disposable test data). FK is ON DELETE
-- RESTRICT so an entry that's been booked against can't be hard-deleted
-- out from under an application; the admin soft-delete (deletedAt) path
-- is unaffected.
--
-- `applications` is owned by evisa_app, so the ALTER succeeds.

BEGIN;

ALTER TABLE "applications"
  ADD COLUMN "visa_type_entry_id" TEXT;

ALTER TABLE "applications"
  ADD CONSTRAINT "applications_visa_type_entry_id_fkey"
  FOREIGN KEY ("visa_type_entry_id")
  REFERENCES "visa_type_entries"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX "applications_visa_type_entry_id_idx"
  ON "applications"("visa_type_entry_id");

COMMIT;
