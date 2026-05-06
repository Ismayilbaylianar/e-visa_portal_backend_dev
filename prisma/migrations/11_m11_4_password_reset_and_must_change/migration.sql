-- M11.4 — production launch hardening for admin auth.
--
-- A. Force-change-password gate. Seeded super admins start with
--    `must_change_password=true`; the first successful login surfaces
--    the modal, the modal calls /admin/auth/change-password which
--    flips the flag false and stamps `last_password_changed_at`.
ALTER TABLE "users"
  ADD COLUMN "must_change_password"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "last_password_changed_at"  TIMESTAMP(3);

-- B. Forgot-password reset tokens.
--    Plain token only ever lives in the URL; DB stores sha256 hash so
--    a leaked DB dump cannot be replayed.
CREATE TABLE "password_reset_tokens" (
  "id"          TEXT          NOT NULL,
  "user_id"     TEXT          NOT NULL,
  "token_hash"  TEXT          NOT NULL,
  "expires_at"  TIMESTAMP(3)  NOT NULL,
  "used_at"     TIMESTAMP(3),
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"  ON "password_reset_tokens"("token_hash");
CREATE INDEX        "password_reset_tokens_user_id_idx"     ON "password_reset_tokens"("user_id");
CREATE INDEX        "password_reset_tokens_expires_at_idx"  ON "password_reset_tokens"("expires_at");
CREATE INDEX        "password_reset_tokens_used_at_idx"     ON "password_reset_tokens"("used_at");
