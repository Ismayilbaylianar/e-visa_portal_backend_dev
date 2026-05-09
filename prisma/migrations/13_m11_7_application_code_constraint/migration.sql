-- M11.7 (A5) — Application code data hygiene.
--
-- 1. Delete the legacy `APP-2026-M9SMOKE` row that broke the M11.6
--    sequence generator before the parseInt fix landed. The applicant
--    has no payment, no documents, and no portal identity attached, so
--    the deletion is safe. We use a defensive WHERE that targets the
--    exact malformed code rather than blanket-deleting any non-matching
--    pattern (which would risk taking out test data on staging).
--
-- 2. Add a CHECK constraint enforcing the canonical
--    `^[A-Z]{2,3}-\d{4}-\d{6}$` shape on every future
--    `application_applicants.application_code`. We only attach the
--    constraint when no violations remain — Postgres validates against
--    existing rows on ADD CONSTRAINT and would otherwise abort the
--    migration. The DO block guards on a runtime row count and skips
--    the constraint creation (with a NOTICE) if any non-conforming
--    code is still present, so a staging environment with extra junk
--    won't block the prod deploy.

-- 1. Delete the legacy M9SMOKE row.
DELETE FROM "application_applicants"
WHERE "application_code" = 'APP-2026-M9SMOKE';

-- 2. Conditionally add the CHECK constraint.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO bad_count
    FROM "application_applicants"
   WHERE "application_code" IS NOT NULL
     AND "application_code" !~ '^[A-Z]{2,3}-\d{4}-\d{6}$';

  IF bad_count > 0 THEN
    RAISE NOTICE 'Skipping application_code CHECK constraint: % non-conforming row(s) remain.', bad_count;
  ELSE
    -- DROP-IF-EXISTS first so re-runs against a partially-applied
    -- migration are idempotent.
    ALTER TABLE "application_applicants"
      DROP CONSTRAINT IF EXISTS "application_applicants_application_code_format";
    ALTER TABLE "application_applicants"
      ADD CONSTRAINT "application_applicants_application_code_format"
      CHECK (
        "application_code" IS NULL
        OR "application_code" ~ '^[A-Z]{2,3}-\d{4}-\d{6}$'
      );
  END IF;
END
$$;
