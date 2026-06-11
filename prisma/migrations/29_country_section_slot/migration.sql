-- Country page sections — slot enum.
--
-- The public country page used to keyword-match section titles into
-- four hardcoded card slots ("Requirements", "Processing Time",
-- "Eligibility", "How to Apply"); admins ended up with brittle title
-- conventions. This migration replaces that with an explicit slot
-- enum the admin picks per section:
--
--   REQUIREMENTS | PROCESSING_TIME | ELIGIBILITY | HOW_TO_APPLY | EXTRA
--
-- `sortOrder` (already present on the table) still drives the public
-- render order. `slot` only decides which visual skin the section
-- renders with; two sections may share a structured slot — the
-- public renderer just renders both in their sortOrder positions.
--
-- DEFAULT 'EXTRA' so any future inserts that forget the column get
-- the plain skin; admins promote sections explicitly. There are no
-- existing rows to backfill (verified on dev: 0 sections, 0 pages).

BEGIN;

-- Idempotent — the enum may already exist if this migration is
-- retried. Same for the column add.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'country_section_slot') THEN
    CREATE TYPE "country_section_slot" AS ENUM (
      'REQUIREMENTS',
      'PROCESSING_TIME',
      'ELIGIBILITY',
      'HOW_TO_APPLY',
      'EXTRA'
    );
  END IF;
END $$;

ALTER TABLE "country_sections"
  ADD COLUMN IF NOT EXISTS "slot" "country_section_slot" NOT NULL DEFAULT 'EXTRA';

COMMIT;
