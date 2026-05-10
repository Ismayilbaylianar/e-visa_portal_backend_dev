-- M11.10 (BUG 4) — Booking-level reference code on Application.
--
-- Business rule: one customer booking → many applicants. Each
-- applicant already has its own APP-YYYY-NNNNNN code; the booking
-- now also gets a single REF-YYYY-NNNNNN code that customers can
-- /track to see ALL applicants in the booking at once.
--
-- Schema: nullable column + UNIQUE constraint (the partial backfill
-- approach in seed.ts wouldn't be safe with NOT NULL since old rows
-- need to be filled in via window-function before the constraint
-- could go live). New rows always get a code from the application
-- code generator.
--
-- Backfill: every existing application gets a code derived from its
-- creation order within its calendar year. ROW_NUMBER() OVER
-- (PARTITION BY year ORDER BY created_at) keeps the suffix stable
-- across re-runs.

ALTER TABLE "applications"
  ADD COLUMN "reference_code" TEXT;

CREATE UNIQUE INDEX "applications_reference_code_key"
  ON "applications" ("reference_code");

-- Backfill existing applications with REF-YYYY-NNNNNN. Pad to 6
-- digits to match the canonical format used by the application code
-- generator (M11.6).
UPDATE "applications" a
   SET "reference_code" = sub.code
  FROM (
    SELECT
      id,
      'REF-'
        || EXTRACT(YEAR FROM created_at)::text
        || '-'
        || LPAD(
             ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM created_at)
               ORDER BY created_at
             )::text,
             6,
             '0'
           ) AS code
    FROM "applications"
    WHERE "deleted_at" IS NULL
  ) sub
 WHERE a.id = sub.id
   AND a."reference_code" IS NULL;
