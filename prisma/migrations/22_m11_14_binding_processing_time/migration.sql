-- M11.14 (BUG OO) — Per-binding processing window (business days)
-- shown to customers on /apply/success and in status emails.
-- Defaults: 7-14 days. Min must be <= max enforced at application
-- layer (validation on the DTO) so the migration stays idempotent.

ALTER TABLE template_bindings
  ADD COLUMN IF NOT EXISTS processing_time_min INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS processing_time_max INTEGER NOT NULL DEFAULT 14;

-- Defensive backfill for rows that somehow ended up with stale NULLs
-- on a partial column add (shouldn't happen with NOT NULL DEFAULT,
-- but cheap insurance).
UPDATE template_bindings
   SET processing_time_min = 7
 WHERE processing_time_min IS NULL;

UPDATE template_bindings
   SET processing_time_max = 14
 WHERE processing_time_max IS NULL;

-- Sanity check constraint: min must be <= max, both positive.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_bindings_processing_window_ck'
  ) THEN
    ALTER TABLE template_bindings
      ADD CONSTRAINT template_bindings_processing_window_ck
      CHECK (processing_time_min >= 1 AND processing_time_max >= processing_time_min);
  END IF;
END $$;
