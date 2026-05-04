-- Module 9 — Application Operations Center.
--
-- Adds the per-applicant status update metadata, the application
-- estimated-processing-time fields, and a dedicated change log table
-- for estimate adjustments. All other M9 dependencies (Application.
-- requestedDocumentTypes, ApplicantStatus.READY_TO_DOWNLOAD,
-- ApplicantStatusHistory) already exist from prior migrations.
--
-- Safe to apply on a live DB:
--   • Every new column is NULLABLE (no backfill needed; readers
--     tolerate null).
--   • New table additive; no FKs touch existing rows.
--   • No DROPs, no enum changes.

-- 1. Per-applicant status touch metadata (denormalized for list views;
--    history table remains the source of truth for the full timeline).
ALTER TABLE "application_applicants" ADD COLUMN "status_updated_at" TIMESTAMP(3);
ALTER TABLE "application_applicants" ADD COLUMN "status_updated_by_user_id" TEXT;

-- 2. Application-level SLA estimate (nullable; admin sets explicitly).
ALTER TABLE "applications" ADD COLUMN "estimated_processing_days" INTEGER;
ALTER TABLE "applications" ADD COLUMN "estimated_time_updated_at" TIMESTAMP(3);

-- 3. Estimated time change log — every adjustment carries a reason;
--    NOT NULL on `reason` enforces "no silent goalpost moves" at the
--    DB level (DTO also enforces min length 3 chars).
CREATE TABLE "application_estimated_time_changes" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "old_days" INTEGER,
    "new_days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_estimated_time_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_estimated_time_changes_application_id_idx"
    ON "application_estimated_time_changes"("application_id");
CREATE INDEX "application_estimated_time_changes_changed_by_user_id_idx"
    ON "application_estimated_time_changes"("changed_by_user_id");
CREATE INDEX "application_estimated_time_changes_created_at_idx"
    ON "application_estimated_time_changes"("created_at");

ALTER TABLE "application_estimated_time_changes"
    ADD CONSTRAINT "application_estimated_time_changes_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_estimated_time_changes"
    ADD CONSTRAINT "application_estimated_time_changes_changed_by_user_id_fkey"
    FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
