-- Module 11.B — Content Management (CMS).
--
-- Adds three additive tables that drive the public marketing copy
-- (about / privacy / terms / contact / faq), the contact-info
-- singleton shown in the footer, and the FAQ list with admin
-- drag-drop reorder.
--
-- Safe to apply on a live DB:
--   • Three new tables only — no ALTERs on existing tables, no
--     enum changes, no DROPs.
--   • No FKs cross into application data, so no cascade risk.
--   • Idempotent seed in seed.ts populates defaults if rows missing.

-- 1. Public marketing pages, addressed by slug.
CREATE TABLE "content_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");
CREATE INDEX "content_pages_slug_idx" ON "content_pages"("slug");
CREATE INDEX "content_pages_is_published_deleted_at_idx"
    ON "content_pages"("is_published", "deleted_at");

-- 2. Contact info singleton — exactly one row per environment.
CREATE TABLE "contact_info" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "business_hours" TEXT,
    "support_hours" TEXT,
    "social_links_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,
    CONSTRAINT "contact_info_pkey" PRIMARY KEY ("id")
);

-- 3. FAQ items, grouped by category, sortable per-category.
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faq_items_category_display_order_idx"
    ON "faq_items"("category", "display_order");
CREATE INDEX "faq_items_is_published_deleted_at_idx"
    ON "faq_items"("is_published", "deleted_at");
