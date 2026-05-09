-- M11.5 — Twin Telegram channels (Alerts + Activity) plus an
-- always-on UI feed. Two tables:
--   notification_events    — append-only event log; mirrors what
--                            the admin /notifications page renders.
--   notification_settings  — admin-controllable per-event toggles,
--                            seeded from EVENT_REGISTRY.

CREATE TABLE "notification_events" (
  "id"            TEXT          NOT NULL,
  "event_type"    TEXT          NOT NULL,
  "severity"      TEXT          NOT NULL,
  "channel"       TEXT          NOT NULL,
  "title"         TEXT          NOT NULL,
  "body"          TEXT          NOT NULL,
  "context_json"  JSONB,
  "status"        TEXT          NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER       NOT NULL DEFAULT 0,
  "last_error"    TEXT,
  "sent_at"       TIMESTAMP(3),
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- Hot path: retry processor scans `(status='pending', created_at)`.
CREATE INDEX "notification_events_status_created_at_idx"
  ON "notification_events"("status", "created_at");
-- Admin UI: paginated by channel, newest first.
CREATE INDEX "notification_events_channel_created_at_idx"
  ON "notification_events"("channel", "created_at" DESC);
CREATE INDEX "notification_events_severity_created_at_idx"
  ON "notification_events"("severity", "created_at" DESC);
CREATE INDEX "notification_events_event_type_idx"
  ON "notification_events"("event_type");

CREATE TABLE "notification_settings" (
  "event_type"  TEXT          NOT NULL,
  "enabled"     BOOLEAN       NOT NULL DEFAULT true,
  "channel"     TEXT          NOT NULL,
  "description" TEXT,
  "updated_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("event_type")
);
