-- M-Assign — Operator assignment per application + internal notes.
--
-- Adds three things:
--   1. applications.assigned_to / assigned_at / assigned_by columns
--      (nullable so existing rows stay valid; assignment is opt-in).
--   2. application_internal_notes — operator-only notes attached to
--      an application, soft-deletable, author-editable.
--   3. application_assignment_history — append-only assignment audit
--      so the admin UI can render "X reassigned from Y to Z".
--
-- Idempotent: every CREATE / ALTER guarded by IF NOT EXISTS / DO $$.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE "applications" ADD COLUMN "assigned_to" TEXT;
    ALTER TABLE "applications"
      ADD CONSTRAINT "applications_assigned_to_fkey"
      FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE "applications" ADD COLUMN "assigned_at" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE "applications" ADD COLUMN "assigned_by" TEXT;
    ALTER TABLE "applications"
      ADD CONSTRAINT "applications_assigned_by_fkey"
      FOREIGN KEY ("assigned_by") REFERENCES "users"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "applications_assigned_to_idx"
  ON "applications" ("assigned_to")
  WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "application_internal_notes" (
  "id"             TEXT         PRIMARY KEY,
  "application_id" TEXT         NOT NULL,
  "user_id"        TEXT         NOT NULL,
  "note"           TEXT         NOT NULL,
  "visibility"     VARCHAR(20)  NOT NULL DEFAULT 'internal',
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"     TIMESTAMP(3),
  CONSTRAINT "application_internal_notes_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "application_internal_notes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "application_internal_notes_application_id_idx"
  ON "application_internal_notes" ("application_id");
CREATE INDEX IF NOT EXISTS "application_internal_notes_user_id_idx"
  ON "application_internal_notes" ("user_id");
CREATE INDEX IF NOT EXISTS "application_internal_notes_created_at_idx"
  ON "application_internal_notes" ("created_at");

CREATE TABLE IF NOT EXISTS "application_assignment_history" (
  "id"                    TEXT         PRIMARY KEY,
  "application_id"        TEXT         NOT NULL,
  "previous_assignee_id"  TEXT,
  "new_assignee_id"       TEXT,
  "changed_by"            TEXT         NOT NULL,
  "reason"                TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_assignment_history_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "application_assignment_history_previous_assignee_id_fkey"
    FOREIGN KEY ("previous_assignee_id") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "application_assignment_history_new_assignee_id_fkey"
    FOREIGN KEY ("new_assignee_id") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "application_assignment_history_changed_by_fkey"
    FOREIGN KEY ("changed_by") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "application_assignment_history_application_id_idx"
  ON "application_assignment_history" ("application_id");
CREATE INDEX IF NOT EXISTS "application_assignment_history_created_at_idx"
  ON "application_assignment_history" ("created_at");
