-- Payment Stage 2 — authorize/capture/release/refund mechanism.
--
-- Adds the AUTHORIZED status (funds held, not captured) + lifecycle
-- timestamps (authorized_at, captured_at) + per-portion full-refund
-- markers (government_fee_refunded_at, service_fee_refunded_at).
--
-- IMPORTANT: this builds the MECHANISM only. The customer pay path still
-- produces PAID (capture/release/refund triggers wire into the two-stage
-- review in Stage 3). No backfill — new columns are nullable.
--
-- `payments` is owned by evisa_app, so the ALTERs succeed. On PG16
-- `ALTER TYPE ... ADD VALUE` is transaction-safe (the value is not used
-- within this migration), so it runs cleanly alongside the table ALTERs.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AUTHORIZED';

ALTER TABLE "payments"
  ADD COLUMN "authorized_at"              TIMESTAMP(3),
  ADD COLUMN "captured_at"                TIMESTAMP(3),
  ADD COLUMN "government_fee_refunded_at" TIMESTAMP(3),
  ADD COLUMN "service_fee_refunded_at"    TIMESTAMP(3);
