-- M11.3 Bug 5 backfill — Payment rows for PAID applications.
--
-- Background: the demo seed (and any older code path) flipped
-- `applications.payment_status` to PAID without inserting a matching
-- row in the `payments` table. As a result the admin Transactions
-- page showed 0 rows even though /admin/applications surfaced a PAID
-- badge for the same records, and the dashboard's `totalRevenue`
-- aggregate evaluated against an empty table.
--
-- This script is idempotent — re-running it is a no-op once every
-- PAID application has at least one non-deleted payments row. Safe to
-- include in deploy automation.
--
-- Fee split note: the source `applications.total_fee_amount` is the
-- single combined number computed at submit time. The original
-- gov/service split lived on the binding+fee row that the application
-- references, but going back to reconstruct it adds complexity for
-- demo data we don't bill against. We split 60/40 (gov/service)
-- which matches the demo seed's BindingNationalityFee weights and
-- keeps the totals correct. Real production payments created via
-- PaymentsService are unaffected — they already record the exact
-- breakdown in their own row.

INSERT INTO payments (
  id,
  application_id,
  payment_reference,
  payment_provider_key,
  currency_code,
  government_fee_amount,
  service_fee_amount,
  expedited_fee_amount,
  total_amount,
  payable_amount,
  payment_status,
  paid_at,
  created_at,
  updated_at
)
SELECT
  -- Stable, deterministic id keyed off application.id so re-running
  -- the script does not change the inserted row's identity.
  ('bf_' || a.id),
  a.id,
  -- Unique payment_reference per application; the bf_ prefix marks
  -- it as a backfill so support can filter these out from real ones.
  ('BACKFILL-' || a.id),
  'mock_demo_seed',
  COALESCE(a.currency_code, 'USD'),
  ROUND(COALESCE(a.total_fee_amount, 0) * 0.6, 2),
  ROUND(COALESCE(a.total_fee_amount, 0) * 0.4, 2),
  CASE WHEN a.expedited THEN ROUND(COALESCE(a.total_fee_amount, 0) * 0.0, 2) ELSE NULL END,
  COALESCE(a.total_fee_amount, 0),
  COALESCE(a.total_fee_amount, 0),
  'PAID'::"PaymentStatus",
  COALESCE(a.updated_at, NOW()),
  COALESCE(a.created_at, NOW()),
  COALESCE(a.updated_at, NOW())
FROM applications a
WHERE a.deleted_at IS NULL
  AND a.payment_status = 'PAID'
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.application_id = a.id
      AND p.deleted_at IS NULL
  );

-- Sanity report — paste these counts into the deploy log.
SELECT
  (SELECT COUNT(*) FROM applications WHERE deleted_at IS NULL AND payment_status = 'PAID')   AS apps_paid,
  (SELECT COUNT(*) FROM payments     WHERE deleted_at IS NULL AND payment_status = 'PAID')   AS payments_paid;
