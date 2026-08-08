-- Stage 3 / Step 1 — status model swap.
--
-- ApplicationStatus: + EXPIRED, + PROCESSING, − IN_REVIEW, − NEED_DOCS
-- ApplicantStatus:   − IN_REVIEW, − NEED_DOCS
--
-- Postgres cannot drop a value from an enum in place, so each type is
-- rebuilt: create the new type → retype every bound column with an
-- explicit text cast → drop the old type → rename. Defaults are
-- dropped before the retype and restored after (a default referencing
-- the old type blocks the ALTER).
--
-- Safe because no row holds a removed value (verified on dev; prod has
-- no applications yet). The guard below re-checks at apply time and
-- aborts the whole migration rather than silently losing data — if it
-- fires, backfill the offending rows to a surviving status first.
--
-- Both enums are owned by evisa_app, so these run without superuser.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "applications"
              WHERE "current_status"::text IN ('IN_REVIEW', 'NEED_DOCS'))
     OR EXISTS (SELECT 1 FROM "application_status_history"
                 WHERE "old_status"::text IN ('IN_REVIEW', 'NEED_DOCS')
                    OR "new_status"::text IN ('IN_REVIEW', 'NEED_DOCS'))
     OR EXISTS (SELECT 1 FROM "application_applicants"
                 WHERE "status"::text IN ('IN_REVIEW', 'NEED_DOCS'))
     OR EXISTS (SELECT 1 FROM "applicant_status_history"
                 WHERE "old_status"::text IN ('IN_REVIEW', 'NEED_DOCS')
                    OR "new_status"::text IN ('IN_REVIEW', 'NEED_DOCS'))
  THEN
    RAISE EXCEPTION
      'Migration 34 aborted: rows still reference IN_REVIEW/NEED_DOCS. Backfill them to a surviving status before re-running.';
  END IF;
END
$$;

-- ── ApplicationStatus ───────────────────────────────────────────────
CREATE TYPE "ApplicationStatus_new" AS ENUM (
  'DRAFT',
  'UNPAID',
  'EXPIRED',
  'SUBMITTED',
  'PROCESSING',
  'APPROVED',
  'READY_TO_DOWNLOAD',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "applications" ALTER COLUMN "current_status" DROP DEFAULT;

ALTER TABLE "applications"
  ALTER COLUMN "current_status" TYPE "ApplicationStatus_new"
  USING ("current_status"::text::"ApplicationStatus_new");

ALTER TABLE "application_status_history"
  ALTER COLUMN "old_status" TYPE "ApplicationStatus_new"
  USING ("old_status"::text::"ApplicationStatus_new");

ALTER TABLE "application_status_history"
  ALTER COLUMN "new_status" TYPE "ApplicationStatus_new"
  USING ("new_status"::text::"ApplicationStatus_new");

DROP TYPE "ApplicationStatus";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";

ALTER TABLE "applications"
  ALTER COLUMN "current_status" SET DEFAULT 'DRAFT'::"ApplicationStatus";

-- ── ApplicantStatus ─────────────────────────────────────────────────
CREATE TYPE "ApplicantStatus_new" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'READY_TO_DOWNLOAD'
);

ALTER TABLE "application_applicants" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "application_applicants"
  ALTER COLUMN "status" TYPE "ApplicantStatus_new"
  USING ("status"::text::"ApplicantStatus_new");

ALTER TABLE "applicant_status_history"
  ALTER COLUMN "old_status" TYPE "ApplicantStatus_new"
  USING ("old_status"::text::"ApplicantStatus_new");

ALTER TABLE "applicant_status_history"
  ALTER COLUMN "new_status" TYPE "ApplicantStatus_new"
  USING ("new_status"::text::"ApplicantStatus_new");

DROP TYPE "ApplicantStatus";
ALTER TYPE "ApplicantStatus_new" RENAME TO "ApplicantStatus";

ALTER TABLE "application_applicants"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ApplicantStatus";

-- ── Retire the start_review + request_documents permissions ─────────
DELETE FROM "role_permissions"
 WHERE "permission_id" IN (
   SELECT "id" FROM "permissions"
    WHERE "module_key" = 'applications' AND "action_key" IN ('start_review', 'request_documents')
 );

DELETE FROM "user_permissions"
 WHERE "permission_id" IN (
   SELECT "id" FROM "permissions"
    WHERE "module_key" = 'applications' AND "action_key" IN ('start_review', 'request_documents')
 );

DELETE FROM "permissions"
 WHERE "module_key" = 'applications' AND "action_key" IN ('start_review', 'request_documents');
