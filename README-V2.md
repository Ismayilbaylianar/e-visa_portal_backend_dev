# E-Visa Portal Backend — README v2 (Sprint 0+ Changelog Draft)

> **This is a working draft.** It accumulates documentation changes as they
> happen across Sprint 0, Sprint 1, etc. At the end of Sprint 1 (after the
> secrets rotation + docs hygiene pass) this file will replace the current
> `README.md` in a single commit.
>
> Do not push this file to GitHub on its own — it is intentionally
> work-in-progress and lives alongside the canonical `README.md` until merge
> time.

---

## Sprint 0 — Migration Baseline & Admin Review Endpoints (DONE)

**Date applied:** 2026-04-27
**Pushed to:** `origin/main` (commits `1f95bbe`, `0046a09`, `6ee99d6`)

### What changed

#### Prisma migration baseline introduced

Until Sprint 0, the project had no `prisma/migrations/` directory and the
production database was managed via `prisma db push`. This was acceptable
during pre-launch, but blocked any further schema discipline.

Sprint 0 introduces a proper migration history:

| Migration | Purpose |
|---|---|
| `prisma/migrations/0_init/migration.sql` | Full baseline of the schema as it was deployed via `db push` (35 tables, all enums, all indexes, all FKs). Marked as already-applied on production via `prisma migrate resolve --applied 0_init`. |
| `prisma/migrations/1_add_admin_review_fields/migration.sql` | The first real migration: adds 5 columns + 1 index + 1 FK on the `applications` table to support admin review actions. Applied via `prisma migrate deploy`. |
| `prisma/migrations/migration_lock.toml` | Locks the provider to PostgreSQL. |

**Going forward:**
- All schema changes MUST go through `npx prisma migrate dev --name <change>` locally
- Production deploys MUST use `npx prisma migrate deploy` (never `db push`)
- `db:push` script in `package.json` is retained for emergency-only use

#### Four admin review endpoints went live

All four admin review actions were implemented earlier (by Cursor) but had
never reached production. Sprint 0 closes that loop.

| Method | Path | Behaviour |
|---|---|---|
| POST | `/api/v1/admin/applications/:id/start-review` | `SUBMITTED` → `IN_REVIEW` |
| POST | `/api/v1/admin/applications/:id/approve` | `SUBMITTED` \| `IN_REVIEW` → `APPROVED` (optional `note`) |
| POST | `/api/v1/admin/applications/:id/reject` | `SUBMITTED` \| `IN_REVIEW` \| `NEED_DOCS` → `REJECTED` (required `reason`, min 10 chars) |
| POST | `/api/v1/admin/applications/:id/request-documents` | `SUBMITTED` \| `IN_REVIEW` → `NEED_DOCS` (required `note`, min 10 chars; optional `documentTypeKeys[]`) |

**Cross-cutting properties of the new endpoints:**
- Permission guard: `applications:review`
- Status transition validation routed through the existing `StatusWorkflowService`
- Audit log entry written for every action via `AuditLogsService.logAdminAction()` with action keys
  `application.start_review`, `application.approve`, `application.reject`, `application.request_documents`
  (includes `oldValueJson` and `newValueJson` with notes / reasons / requested doc types)
- Status notification email sent via `EmailService.sendApplicationStatusEmail()` —
  email failure does NOT block the status change (graceful degradation)

#### Schema additions on `Application`

```prisma
reviewedAt              DateTime?
reviewedByUserId        String?     // FK to User (ON DELETE SET NULL)
adminNote               String?     @db.Text
rejectionReason         String?     @db.Text
requestedDocumentTypes  String[]    @default([])
```

`User` gained the inverse relation `applicationReviews Application[]`.

#### Pre-existing prettier formatting committed

A separate `chore` commit applied prettier formatting to 14 files in
`email/`, `storage/`, `portalAuth/`, `notifications/`, `auth/`, and
`documents/` modules. Zero behaviour change. This was done so the next
feature commits start from a clean format baseline.

### Verification on production after deploy

```bash
# Endpoints are visible in Swagger
curl -s http://46.224.16.161/docs-json \
  | jq '.paths | keys[]' \
  | grep -E "approve|reject|request-documents|start-review"
# Expected: 4 lines

# Health still green
curl -s http://46.224.16.161/api/v1/system/health/live  | jq
curl -s http://46.224.16.161/api/v1/system/health/ready | jq

# Manual end-to-end (browser)
# 1. /admin/login as super@visa.com
# 2. /admin/applications -> pick a SUBMITTED application
# 3. start-review -> approve (or reject with reason)
# 4. /admin/auditLogs -> see application.start_review and application.approve rows
```

### Known follow-ups surfaced during Sprint 0

These are NOT Sprint 0 work; they are tracked for future passes.

- **Lint hygiene (Sprint 3+):** 11 pre-existing lint errors in
  `countrySections/dto/`, `geoLookup/dto/`, `jobs/jobs.service.ts`,
  `storage/providers/s3-storage.provider.ts` (mostly unused imports / mock
  S3 scaffold parameters). One additional `any` warning was introduced in
  `applications/dto/admin-review.dto.ts`. None block production.
- **Prisma schema formatting:** `npx prisma format` would reformat one
  alignment block in the User model (single space difference). Left as-is
  to keep the commit history aligned with what Cursor produced. Will be
  bundled into a future format pass.
- **Frontend repository on GitHub (Sprint 1+):** The frontend repo on
  `~/Desktop/e-visa-portal-frontend` has no GitHub remote and only an
  initial Next.js scaffold commit. The entire admin/, public/, components/,
  and lib/ tree is uncommitted locally. A separate task will create the
  GitHub repo and push the first canonical commit once the frontend
  iterations stabilise.
- **`fieldKey` uniqueness contradiction (long-term):** The handover claims
  `fieldKey` is unique within an entire template, but the schema has
  `@@unique([templateSectionId, fieldKey])` (section-scoped). Schema wins
  for now. If template-scoped uniqueness is the design intent, a future
  migration will lift the constraint with a data-rename pass.

---

## Sprint 1 — coming up next

To be filled in as Tasks 1, 2, 3 land:

- [ ] Task 1 — Secrets rotation + docs hygiene
- [ ] Task 2 — Seed data
- [ ] Task 3 — Logo & branding

Once Sprint 1 closes, this file replaces the current `README.md` and the
existing Public-Repo-Safety, Default-Admin-Users, and curl-example sections
will be rewritten in place.
