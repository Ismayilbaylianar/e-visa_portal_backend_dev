-- M11.13 (BUG Z) — Soft-delete-aware uniqueness on (template_section_id, field_key).
--
-- The original UNIQUE constraint
--   template_fields_template_section_id_field_key_key (template_section_id, field_key)
-- counted soft-deleted rows. Real symptom from Anar's hard test:
-- admin added a "gender" field, deleted it (soft delete sets
-- `deleted_at`), then tried to re-add "gender" → P2002 from
-- postgres even though the active set had no gender row. The
-- service-layer pre-check at TemplateFieldsService.create() also
-- uses `deletedAt: null` and correctly passed, only for the DB
-- constraint to fire one query later.
--
-- Fix: replace the full constraint with a PARTIAL unique index
-- that scopes uniqueness to active (non-soft-deleted) rows only.
-- Soft-deleted rows free their (section_id, field_key) slot
-- immediately; re-adding the same key after a delete succeeds.
--
-- Idempotent: every step uses IF EXISTS / IF NOT EXISTS so
-- re-running the migration in the staging-then-prod pattern is
-- safe.

DO $$
BEGIN
  -- Drop the legacy non-partial constraint if Prisma named it
  -- with the auto-generated "*_key" suffix.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'template_fields_template_section_id_field_key_key'
  ) THEN
    ALTER TABLE "template_fields"
      DROP CONSTRAINT "template_fields_template_section_id_field_key_key";
  END IF;

  -- Some environments may have created a duplicate plain index
  -- with this name — drop it too so we don't end up with two
  -- competing indexes on the same column pair.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'template_fields_template_section_id_field_key_key'
  ) THEN
    DROP INDEX "template_fields_template_section_id_field_key_key";
  END IF;
END $$;

-- Create the partial unique index. Naming convention matches the
-- existing M11.12 indexes (foo_bar_active_uniq).
CREATE UNIQUE INDEX IF NOT EXISTS "template_fields_section_field_key_active_uniq"
  ON "template_fields" ("template_section_id", "field_key")
  WHERE "deleted_at" IS NULL;
