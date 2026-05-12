-- M11.14 (BUG SS) — Re-seed the canonical FAQ categories.
--
-- The M11.7 (C1) seed in migration 14 was correctly applied at deploy
-- time, but the M11.14 pre-launch reset (deleted faq_categories +
-- faq_items rows wholesale) left the table empty. Without categories,
-- the admin FAQ form's dropdown is empty and the new
-- /admin/faq-categories page renders an empty list, so admins can't
-- create new FAQs at all.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING + filter on deleted_at IS
-- NULL means re-running after a partial reseed is a no-op. The slugs
-- here intentionally match migration 14 so existing FAQ items whose
-- `category` string was preserved across the reset (none here, but
-- in general) keep resolving.

INSERT INTO "faq_categories" ("id", "key", "display_name", "display_order", "updated_at")
VALUES
  (gen_random_uuid(), 'general',     'General Questions',      0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'visa',        'Visa Types & Pricing',   1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'application', 'Application Process',    2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'payment',     'Payment & Refunds',      3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'support',     'Technical Support',      4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'other',       'Other',                  5, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Revive any that an admin previously soft-deleted by mistake. Cheap
-- safety net — the partial-unique index on `key` would otherwise let
-- a second active row coexist with the soft-deleted one, but our
-- table has no partial unique (the key is globally unique). So
-- reviving the existing row is the only path back.
UPDATE "faq_categories"
   SET "deleted_at" = NULL,
       "is_active"  = TRUE,
       "updated_at" = CURRENT_TIMESTAMP
 WHERE "key" IN ('general','visa','application','payment','support','other')
   AND "deleted_at" IS NOT NULL;
