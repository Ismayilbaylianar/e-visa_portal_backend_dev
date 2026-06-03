-- M11.15-HELP-V2 PART 2 — Self-hosted video on help articles.
--
-- Adds five columns describing the optional uploaded video and a
-- check constraint that enforces "at most one of (video_url,
-- video_file_path)" — so an article either embeds a URL (YouTube /
-- Vimeo) OR streams an uploaded file, never both, never both null
-- when video_storage_type is set.
--
-- The signed-URL streaming endpoint lives in the service; this
-- migration only opens the columns it writes into. Idempotent
-- (ADD COLUMN IF NOT EXISTS + DO blocks for the constraint).

ALTER TABLE "help_articles"
  ADD COLUMN IF NOT EXISTS "video_file_path"        TEXT,
  ADD COLUMN IF NOT EXISTS "video_storage_type"     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "video_size_bytes"       BIGINT,
  ADD COLUMN IF NOT EXISTS "video_duration_seconds" INT,
  ADD COLUMN IF NOT EXISTS "video_mime_type"        VARCHAR(60);

-- video_storage_type is a tiny enum-like string. Tighten it with a
-- CHECK so future code can rely on the legal value set without a
-- formal Postgres enum.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'help_articles_video_storage_type_chk'
  ) THEN
    ALTER TABLE "help_articles"
      ADD CONSTRAINT "help_articles_video_storage_type_chk"
      CHECK (
        "video_storage_type" IS NULL OR
        "video_storage_type" IN ('url','upload')
      );
  END IF;
END $$;

-- XOR constraint: video_url and video_file_path can both be NULL
-- (article has no video) or exactly one can be set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'help_articles_video_xor'
  ) THEN
    ALTER TABLE "help_articles"
      ADD CONSTRAINT "help_articles_video_xor"
      CHECK (
        ("video_url" IS NULL AND "video_file_path" IS NULL) OR
        ("video_url" IS NOT NULL AND "video_file_path" IS NULL) OR
        ("video_url" IS NULL AND "video_file_path" IS NOT NULL)
      );
  END IF;
END $$;

-- Quick lookup helper for the streaming endpoint (it resolves
-- article.video_file_path from a signed token).
CREATE INDEX IF NOT EXISTS "help_articles_video_upload_idx"
  ON "help_articles"("id") WHERE "video_file_path" IS NOT NULL;
