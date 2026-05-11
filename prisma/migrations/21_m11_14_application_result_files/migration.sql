-- M11.14 (BUG FF — PART 2) — application_result_files
--
-- Operator uploads the issued visa PDF (and optional supporting
-- files like reference codes / receipts / instructions) here. The
-- customer pulls them from /portal/[code]?intent=download via the
-- public portal endpoints once status is APPROVED or
-- READY_TO_DOWNLOAD.
--
-- Distinct from the existing `applicants.result_storage_key` /
-- `applicants.result_file_name` fields (those captured the M9
-- single-file-per-applicant flow). This table is the multi-file
-- replacement at the APPLICATION level (one app, many files,
-- exactly one `is_primary`), with full audit + soft-delete.
--
-- Idempotent: every CREATE guarded by IF NOT EXISTS / DO $$.

CREATE TABLE IF NOT EXISTS "application_result_files" (
  "id"              TEXT         PRIMARY KEY,
  "application_id"  TEXT         NOT NULL,
  -- Optional applicant scope. When null, the file applies to the
  -- whole application (e.g. a single combined PDF for a family).
  -- When set, customer UI shows it grouped under that applicant.
  "applicant_id"    TEXT,
  "file_name"       VARCHAR(255) NOT NULL,
  "storage_key"     TEXT         NOT NULL,
  "storage_path"    TEXT         NOT NULL,
  "storage_provider" TEXT        NOT NULL DEFAULT 'local',
  "file_size"       INT,
  "mime_type"       VARCHAR(100),
  "description"     TEXT,
  "is_primary"      BOOLEAN      NOT NULL DEFAULT false,
  "uploaded_by"     TEXT         NOT NULL,
  "uploaded_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"      TIMESTAMP(3),
  CONSTRAINT "application_result_files_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "application_result_files_applicant_id_fkey"
    FOREIGN KEY ("applicant_id") REFERENCES "application_applicants"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "application_result_files_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "application_result_files_application_id_idx"
  ON "application_result_files" ("application_id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "application_result_files_applicant_id_idx"
  ON "application_result_files" ("applicant_id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "application_result_files_uploaded_at_idx"
  ON "application_result_files" ("uploaded_at");

-- Partial unique: only one is_primary file per application at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "application_result_files_primary_uniq"
  ON "application_result_files" ("application_id")
  WHERE "is_primary" = true AND "deleted_at" IS NULL;
