-- Module 1.5 — Split countries into reference (Country) + publishable
-- content (CountryPage). Atomic, in-transaction migration. Safe for
-- the current production state (3 publishable countries: TR/AZ/AE,
-- 3 country_sections all attached to TR, 0 applications).
--
-- Order of operations is intentional:
--   1. Add new reference columns to countries (nullable temporarily)
--   2. Backfill the 3 known seeded rows so NOT NULL can be enforced
--   3. Promote those columns to NOT NULL
--   4. Create country_pages table
--   5. Move publishable rows from countries → country_pages
--   6. Add country_sections.country_page_id, backfill via JOIN, sanity-check,
--      drop old country_id column, set new FK
--   7. Drop the publishable columns from countries (slug, is_published, etc.)
--   8. Recreate / drop indexes + add foreign keys
--
-- Subsequent UN seed (npm run prisma:seed) upserts all 250 ISO 3166-1
-- alpha-2 rows, overwriting the 3 backfilled values with canonical UN data
-- and inserting the remaining 247.

-- ============================================================
-- 1. Add new reference columns to countries (nullable for backfill window)
-- ============================================================
ALTER TABLE "countries"
  ADD COLUMN "flag_emoji" TEXT,
  ADD COLUMN "continent_code" TEXT,
  ADD COLUMN "region" TEXT;

-- ============================================================
-- 2. Backfill the 3 currently-seeded production countries.
--    Values match prisma/data/countries-iso3166.json so the post-seed
--    state is identical to the pre-migration mental model.
-- ============================================================
UPDATE "countries"
  SET "flag_emoji" = '🇹🇷', "continent_code" = 'AS', "region" = 'Western Asia'
  WHERE "iso_code" = 'TR';

UPDATE "countries"
  SET "flag_emoji" = '🇦🇿', "continent_code" = 'AS', "region" = 'Western Asia'
  WHERE "iso_code" = 'AZ';

UPDATE "countries"
  SET "flag_emoji" = '🇦🇪', "continent_code" = 'AS', "region" = 'Western Asia'
  WHERE "iso_code" = 'AE';

-- Sanity: every existing row must have backfilled values before NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "countries"
    WHERE ("flag_emoji" IS NULL OR "continent_code" IS NULL OR "region" IS NULL)
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration aborted: countries has rows without reference backfill';
  END IF;
END $$;

-- ============================================================
-- 3. Promote new reference columns to NOT NULL
-- ============================================================
ALTER TABLE "countries"
  ALTER COLUMN "flag_emoji" SET NOT NULL,
  ALTER COLUMN "continent_code" SET NOT NULL,
  ALTER COLUMN "region" SET NOT NULL;

-- ============================================================
-- 4. Create country_pages table
-- ============================================================
CREATE TABLE "country_pages" (
    "id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "country_pages_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 5. Move publishable rows from countries → country_pages
--    Generates new uuids; preserves the relationship via country_id FK.
--    Only rows with is_published = true today are migrated; rows that
--    were created later as references (Pre-Sprint-3 seed had 3 such rows)
--    do not need a page yet.
-- ============================================================
INSERT INTO "country_pages" (
  "id", "country_id", "slug", "seo_title", "seo_description",
  "is_published", "is_active", "sort_order", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "slug",
  "seo_title",
  "seo_description",
  "is_published",
  "is_active",
  0,
  "created_at",
  NOW()
FROM "countries"
WHERE "is_published" = true
  AND "deleted_at" IS NULL;

-- ============================================================
-- 6. country_sections.country_id  →  country_page_id
-- ============================================================
ALTER TABLE "country_sections" ADD COLUMN "country_page_id" TEXT;

UPDATE "country_sections" cs
SET "country_page_id" = cp."id"
FROM "country_pages" cp
WHERE cp."country_id" = cs."country_id";

-- Sanity: every section must now have a country_page_id mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "country_sections"
    WHERE "country_page_id" IS NULL AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration aborted: country_sections has rows without country_page_id mapping (orphaned)';
  END IF;
END $$;

ALTER TABLE "country_sections"
  DROP CONSTRAINT "country_sections_country_id_fkey",
  DROP COLUMN "country_id",
  ALTER COLUMN "country_page_id" SET NOT NULL;

-- ============================================================
-- 7. Drop publishable columns from countries
-- ============================================================
ALTER TABLE "countries"
  DROP COLUMN "slug",
  DROP COLUMN "is_published",
  DROP COLUMN "seo_title",
  DROP COLUMN "seo_description";

-- ============================================================
-- 8. Drop / recreate indexes
-- ============================================================
DROP INDEX IF EXISTS "countries_slug_key";
DROP INDEX IF EXISTS "countries_slug_idx";
DROP INDEX IF EXISTS "countries_is_published_idx";
DROP INDEX IF EXISTS "country_sections_country_id_idx";

CREATE INDEX "countries_continent_code_idx" ON "countries"("continent_code");

CREATE UNIQUE INDEX "country_pages_country_id_key" ON "country_pages"("country_id");
CREATE UNIQUE INDEX "country_pages_slug_key" ON "country_pages"("slug");
CREATE INDEX "country_pages_country_id_idx" ON "country_pages"("country_id");
CREATE INDEX "country_pages_slug_idx" ON "country_pages"("slug");
CREATE INDEX "country_pages_is_published_idx" ON "country_pages"("is_published");
CREATE INDEX "country_pages_is_active_idx" ON "country_pages"("is_active");
CREATE INDEX "country_pages_deleted_at_idx" ON "country_pages"("deleted_at");

CREATE INDEX "country_sections_country_page_id_idx" ON "country_sections"("country_page_id");

-- ============================================================
-- 9. Add foreign keys
-- ============================================================
ALTER TABLE "country_pages"
  ADD CONSTRAINT "country_pages_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "country_sections"
  ADD CONSTRAINT "country_sections_country_page_id_fkey"
    FOREIGN KEY ("country_page_id") REFERENCES "country_pages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
