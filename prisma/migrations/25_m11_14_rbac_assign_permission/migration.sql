-- M11.14 (RBAC audit) — split the "assign operator" action out of the
-- generic applications.update permission so an operator can self-assign
-- (claim their own work) WITHOUT also being able to reassign other
-- people's bookings to themselves or to another operator.
--
-- Before this migration the POST /admin/applications/:id/assign
-- endpoint was guarded by applications.update — operators have that
-- permission for their daily review work, so the audit found they
-- could also reassign any application to any user. Anar's policy
-- says only admin + superAdmin can do cross-assignment.
--
-- New permission key: `applications.assign`. The service-layer guard
-- introduced alongside this migration allows operators to assign /
-- unassign themselves under the existing applications.update perm,
-- and gates assignment to ANY OTHER user on applications.assign.
-- Idempotent — ON CONFLICT (permission_key) DO NOTHING on the insert
-- and "NOT EXISTS" guards on the grants.

INSERT INTO "permissions" ("id", "module_key", "action_key", "permission_key", "description")
VALUES (
  gen_random_uuid()::text,
  'applications',
  'assign',
  'applications.assign',
  'Assign or reassign an application to another user (admin+ only). Operators can only self-assign via applications.update.'
)
ON CONFLICT ("permission_key") DO NOTHING;

-- Grant to superAdmin (catch-all). Skip if already granted.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT
  gen_random_uuid()::text,
  r.id,
  p.id
FROM "roles" r, "permissions" p
WHERE r.key = 'superAdmin'
  AND p.permission_key = 'applications.assign'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Grant to admin (full ops). Operator deliberately omitted.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT
  gen_random_uuid()::text,
  r.id,
  p.id
FROM "roles" r, "permissions" p
WHERE r.key = 'admin'
  AND p.permission_key = 'applications.assign'
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
