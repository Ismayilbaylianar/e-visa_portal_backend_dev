-- Module 11.2 — Per-binding expedited config + boilerplate template flag.
--
-- Three additive columns. Backfill is idempotent and read-only on
-- existing data — safe to apply on a live DB.
--
-- Why per-binding (not per-template, not per-nationality-fee):
--   • Per-template was the brief's hypothesis but the live schema
--     keeps expedited columns on BindingNationalityFee (per-fee).
--   • Per-fee is too granular for the admin UX the brief wants —
--     "Türkiye supports same-day, Egypt doesn't" is a property of
--     the (destination, visa type) combo, not the (destination, visa
--     type, nationality) triple.
--   • Adding binding-level columns gives a single canonical source
--     the public preview reads from. Per-fee columns stay on the
--     table as deprecated-but-non-breaking metadata until a future
--     cleanup migration.

-- 1. Per-binding expedited config (default OFF — admin opts in).
ALTER TABLE "template_bindings"
  ADD COLUMN "expedited_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expedited_fee_amount" DECIMAL(10, 2);

-- 2. Backfill from BindingNationalityFee — if ANY active fee on a
--    binding has expeditedEnabled=true, treat the binding itself as
--    expedited-enabled and copy the highest fee amount as the default.
--    Multiple fees per binding (one per nationality) typically share
--    the same expedited config, so MAX is a safe deterministic pick.
UPDATE "template_bindings" tb
SET "expedited_enabled" = true,
    "expedited_fee_amount" = sub.max_fee
FROM (
  SELECT "template_binding_id", MAX("expedited_fee_amount") AS max_fee
  FROM "binding_nationality_fees"
  WHERE "expedited_enabled" = true
    AND "deleted_at" IS NULL
  GROUP BY "template_binding_id"
) sub
WHERE tb."id" = sub."template_binding_id";

-- 3. Template boilerplate flag — clones-only, not directly bindable.
ALTER TABLE "templates"
  ADD COLUMN "is_boilerplate" BOOLEAN NOT NULL DEFAULT false;
