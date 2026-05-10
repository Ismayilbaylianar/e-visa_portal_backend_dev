-- M11.10 (BUG 7) — Secondary contact channels.
--
-- Pragmatic scope cut vs the dynamic-channels brief. Adds named
-- secondary slots so admins can capture "Sales phone", "Emergency
-- WhatsApp", a Telegram handle, and a free-form customNote block
-- without needing a new table + dynamic CRUD UI before launch.
--
-- All columns nullable so the existing M11.7 hide-when-blank logic
-- on /contact keeps working unchanged. Full dynamic channels is
-- queued for post-launch.

ALTER TABLE "contact_info"
  ADD COLUMN IF NOT EXISTS "email_2"     TEXT,
  ADD COLUMN IF NOT EXISTS "phone_2"     TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp_2"  TEXT,
  ADD COLUMN IF NOT EXISTS "telegram"    TEXT,
  ADD COLUMN IF NOT EXISTS "custom_note" TEXT;
