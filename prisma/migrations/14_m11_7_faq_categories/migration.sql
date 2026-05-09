-- M11.7 (C1) — FAQ category lookup table.
--
-- New `faq_categories` table is a soft lookup for the existing
-- `faq_items.category` string. We don't add a UUID FK column because:
--   1. Existing rows already use category-as-string; a UUID FK would
--      require a backfill + dual-write window.
--   2. The frontend public endpoint only needs ordered display names,
--      which a join on `faq_items.category = faq_categories.key`
--      delivers cleanly.
--   3. Renaming a category in the admin tab is now O(1) (update
--      `display_name`) without touching items.
--
-- Default seed mirrors the brief: General Questions, Visa Types &
-- Pricing, Application Process, Payment & Refunds, Technical Support.
-- Existing items with legacy keys (general, application, payment,
-- visa, other) keep rendering — their category strings still match
-- the legacy categories that the previous frontend hardcoded.

CREATE TABLE "faq_categories" (
  "id"            TEXT          NOT NULL,
  "key"           TEXT          NOT NULL,
  "display_name"  TEXT          NOT NULL,
  "display_order" INTEGER       NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN       NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL,
  "deleted_at"    TIMESTAMP(3),

  CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faq_categories_key_key" ON "faq_categories"("key");
CREATE INDEX "faq_categories_display_order_idx" ON "faq_categories"("display_order");
CREATE INDEX "faq_categories_is_active_deleted_at_idx"
  ON "faq_categories"("is_active", "deleted_at");

-- Seed the default categories. INSERT…ON CONFLICT keeps the migration
-- idempotent if it lands on a partially-seeded environment (e.g. a
-- staging box where someone manually created `general` already).
INSERT INTO "faq_categories" ("id", "key", "display_name", "display_order", "updated_at")
VALUES
  (gen_random_uuid(), 'general',     'General Questions',      0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'visa',        'Visa Types & Pricing',   1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'application', 'Application Process',    2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment',     'Payment & Refunds',      3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'support',     'Technical Support',      4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'other',       'Other',                  5, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
