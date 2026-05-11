-- M11.12 (BUG P) — Track operator → customer document requests as
-- structured data instead of just `application.requested_document_types String[]`.
--
-- The legacy `applications.requested_document_types` array still
-- drives the existing customer /me UI (lite-shipping path per the
-- M11.12 spec) — these new tables exist alongside for:
--   * audit trail (who requested what + when)
--   * per-item formats / size limits the customer-side upload page
--     will read once it ships post-launch
--   * fulfillment tracking so we can auto-flip status when ALL
--     items are uploaded (the existing array-based flow only knows
--     about types, not which specific item satisfied which request)
--
-- Idempotent: every CREATE uses IF NOT EXISTS, so re-applying this
-- migration in the staging-then-prod pattern is safe.

CREATE TABLE IF NOT EXISTS "document_requests" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" UUID         NOT NULL,
  "requested_by"   UUID         NOT NULL,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "custom_message" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilled_at"   TIMESTAMP(3),
  CONSTRAINT "document_requests_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "document_requests_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "document_requests_application_id_idx"
  ON "document_requests" ("application_id");
CREATE INDEX IF NOT EXISTS "document_requests_status_idx"
  ON "document_requests" ("status");
CREATE INDEX IF NOT EXISTS "document_requests_created_at_idx"
  ON "document_requests" ("created_at");

CREATE TABLE IF NOT EXISTS "document_request_items" (
  "id"                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id"            UUID         NOT NULL,
  "document_name"         VARCHAR(200) NOT NULL,
  "accepted_formats"      TEXT,
  "max_size_mb"           INT          NOT NULL DEFAULT 10,
  "uploaded_document_id"  UUID,
  "uploaded_at"           TIMESTAMP(3),
  CONSTRAINT "document_request_items_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "document_requests"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "document_request_items_uploaded_document_id_fkey"
    FOREIGN KEY ("uploaded_document_id") REFERENCES "documents"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "document_request_items_request_id_idx"
  ON "document_request_items" ("request_id");
CREATE INDEX IF NOT EXISTS "document_request_items_uploaded_document_id_idx"
  ON "document_request_items" ("uploaded_document_id");
