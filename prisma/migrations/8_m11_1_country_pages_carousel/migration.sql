-- Module 11.1 — Carousel & Country Page Images.
--
-- Two new tables for admin-managed marketing imagery:
--   • country_page_images — hero-slider images per country page
--   • homepage_slides     — promotional carousel cards on the homepage
--
-- Safe to apply on a live DB:
--   • Two new tables only — no ALTERs on existing tables, no enum
--     changes, no DROPs.
--   • country_page_images cascades from country_pages on delete so
--     orphan rows can never accumulate when a page is hard-removed.
--   • homepage_slides.country_id is nullable + SET NULL on country
--     delete — slides survive the country going inactive but lose
--     their auto-derived CTA target.

-- 1. Country-page hero slider images
CREATE TABLE "country_page_images" (
    "id" TEXT NOT NULL,
    "country_page_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "country_page_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "country_page_images_country_page_id_display_order_idx"
    ON "country_page_images"("country_page_id", "display_order");
CREATE INDEX "country_page_images_is_published_deleted_at_idx"
    ON "country_page_images"("is_published", "deleted_at");

ALTER TABLE "country_page_images"
    ADD CONSTRAINT "country_page_images_country_page_id_fkey"
    FOREIGN KEY ("country_page_id") REFERENCES "country_pages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Homepage carousel slides
CREATE TABLE "homepage_slides" (
    "id" TEXT NOT NULL,
    "country_id" TEXT,
    "image_url" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "cta_text" TEXT NOT NULL DEFAULT 'Apply Now',
    "cta_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "homepage_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homepage_slides_display_order_idx"
    ON "homepage_slides"("display_order");
CREATE INDEX "homepage_slides_is_published_deleted_at_idx"
    ON "homepage_slides"("is_published", "deleted_at");

ALTER TABLE "homepage_slides"
    ADD CONSTRAINT "homepage_slides_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
