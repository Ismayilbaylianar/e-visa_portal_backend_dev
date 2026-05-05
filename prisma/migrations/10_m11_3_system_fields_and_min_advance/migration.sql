-- M11.3 — system fields + per-binding minimum arrival lead time.
--
-- A. Lock-flag + stable identifier on template_fields.
--    is_system = true means admin can rename/reorder/hide but cannot
--    delete, change type, or modify validation rules. system_key is
--    the stable cross-field reference token (e.g. "passportExpiryDate")
--    that survives label rename — used by date keywords like
--    `$passportExpiryDate` so cross-field rules don't break when an
--    admin renames "Expiry Date" to something localized.
ALTER TABLE "template_fields"
  ADD COLUMN "is_system"  BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN "system_key" TEXT;

CREATE INDEX "template_fields_is_system_idx"  ON "template_fields"("is_system");
CREATE INDEX "template_fields_system_key_idx" ON "template_fields"("system_key");

-- B. Per-binding minimum arrival days advance.
--    Default 3 — admin tunes via the Destination Manager. Public
--    preview surfaces this so the customer-side renderer can set the
--    native picker's `min` to today + N.
ALTER TABLE "template_bindings"
  ADD COLUMN "min_arrival_days_advance" INTEGER NOT NULL DEFAULT 3;
