# E-Visa Global — Layihə Kontekst Sənədi

> Bu sənəd başqa Claude söhbətində layihə kontekstini bərpa etmək üçündür.
> Tarix: **Sprint 3 / Modul 6a tamamlandı** (Modul 6b sonrakı növbə).
> Hər iki repo-nun kök qovluğunda eyni sənəd var — backend repo-da git ilə tracked, frontend repo-da rsync ilə deploy olunur.

---

## 1. LAYİHƏ HAQQINDA

### Brand identity (təsdiq olunmuş)
- **Layihə adı:** E-Visa Global
- **Public domain:** evisaglobal.com
- **Resend domeni:** evisaglobal.com (Sprint 2-də verified)
- **SMTP From:** noreply@evisaglobal.com
- ⚠️ **Yasaq:** "dreamsparrow" və ya "E-Visa Portal" hardcoded strings istifadə etmə. Generic dev fallback-lər: "Visa Portal", "support@example.com", "noreply@example.com". Real brand yalnız user-facing UI mətnlərində.

### Məqsəd
Onlayn e-Visa müraciət platforması:
- Public istifadəçi (PortalIdentity) ölkə + visa tipi seçir, müraciət edir
- Admin paneli (User + Role + Permission RBAC) müraciətləri review edir
- Müştərilər ödəniş edir, status izləyir
- 5 system email template avtomatik göndərilir (OTP, status update, payment confirmation, və s.)

### Stack

**Backend** (`/Users/anarismayilbayli/Desktop/e-visa_portal_backend_dev`):
- NestJS 10.3 + TypeScript 5.3
- Prisma 5.22 ORM + PostgreSQL 16
- Passport JWT (admin + portal pairs separate)
- bcrypt 5.1, class-validator 0.14, class-transformer 0.5
- nodemailer (Resend SMTP via port 587 STARTTLS)
- Helmet, Throttler (rate-limiting)
- Swagger (auto-generated docs)

**Frontend** (`/Users/anarismayilbayli/Desktop/e-visa-portal-frontend`):
- Next.js 16.2 (App Router) + React 19.2
- TypeScript 5
- TanStack Query 5 (server state) + Zustand 5 (auth store with persist)
- Radix UI primitives + Tailwind CSS 4
- React Hook Form 7.74 + Zod 4.3 (form validation)
- Sonner (toast notifications)
- date-fns 4, lucide-react icons

**İnfrastruktur:**
- Server: Hetzner Cloud, IP `46.224.16.161` (host `evisa-prod-1`)
- pm2 (evisa-backend port 3000, evisa-frontend port 3001)
- nginx reverse proxy
- fail2ban (SSH 5x failure → 24h ban)
- PostgreSQL 16 (DB: `evisa_prod`, user: `evisa_app`)

### Layihə strukturu

**Backend:**
```
src/
├── main.ts                    # NestJS bootstrap (helmet, CORS, validation pipes, Swagger)
├── app.module.ts              # Root module — bütün domain modullarını wire edir
├── config/                    # Environment config (typed via @nestjs/config)
├── common/
│   ├── constants/             # ErrorCodes (lowercase.dot strings)
│   ├── decorators/            # @Public, @CurrentUser, @RequirePermissions, @RateLimit
│   ├── dto/                   # PaginationQueryDto (parent — modullar @Max(500) ilə override edir)
│   ├── exceptions/            # NotFound, Conflict, Forbidden (typed details[])
│   ├── filters/               # GlobalExceptionFilter (uniform envelope)
│   ├── guards/                # JwtAuthGuard, PermissionsGuard, RolesGuard
│   ├── interceptors/
│   └── types/                 # AuthenticatedUser, Request types
└── modules/
    ├── accessControl/         # AccessControlService.checkPermission, getUserPermissions
    │                          # + system-protection.constants.ts (SYSTEM_ROLE_KEYS)
    ├── auth/                  # Admin login/refresh/logout + getUserPermissions wired in
    ├── portalAuth/            # Public portal OTP login (separate JWT pair)
    ├── users/                 # Modul 6a — admin CRUD + system protect
    ├── roles/                 # Modul 6a — CRUD + system rename block
    ├── permissions/           # Modul 6a — list/matrix + role/user perm updates
    ├── sessions/              # Active admin sessions
    ├── countries/             # Modul 1.5 reference (250 UN ISO 3166-1 rows)
    ├── countryPages/          # Modul 1.5 publishable (slug + SEO + sections)
    ├── countrySections/       # Nested under countryPages
    ├── visaTypes/             # Modul 2 — purpose × entries unique
    ├── templates/             # Form templates (Modul 7 — pending)
    ├── templateSections/      # Sections inside templates
    ├── templateFields/        # Fields inside sections
    ├── templateBindings/      # Binds template + visa type + country + fees (Modul 8)
    ├── bindingNationalityFees/# Per-nationality fee overrides
    ├── emailTemplates/        # Modul 3 — system protect (5 system keys)
    ├── settings/              # Modul 4 — singleton (18 fields)
    ├── paymentPageConfigs/    # Modul 5 — singleton (11 admin fields + sectionsJson)
    ├── applications/          # Public applications + admin review
    ├── applicants/            # Per-application applicants
    ├── documents/             # Uploaded documents + review
    ├── payments/              # Payment records
    ├── paymentTransactions/   # Provider transaction records
    ├── notifications/         # Email queue (TODO: real queue integration in Sprint 5)
    ├── email/                 # SMTP provider + template renderer
    ├── auditLogs/             # logAdminAction(actor, key, entityType, id, before, after)
    ├── jobs/                  # Background jobs registry
    ├── geoLookup/             # IP → country
    ├── publicSelection/       # Public country/visa dropdowns
    ├── customerPortal/        # Customer-facing endpoints
    ├── tracking/              # Public application tracking
    ├── statusWorkflow/        # Application status FSM
    ├── storage/               # File storage (local /var/www/evisa-backend/uploads)
    ├── otp/                   # OTP code lifecycle
    ├── formRenderer/          # Renders form templates for public apply flow
    ├── dashboard/             # Admin dashboard stats + charts
    ├── health/                # /health endpoint
    └── prisma/                # PrismaService wrapper

prisma/
├── schema.prisma              # 36 models, 5 enums (PermissionEffect, VisaEntryType, …)
├── seed.ts                    # 51 permissions + 3 system roles + 3 users + sample data
├── data/
│   └── countries-iso3166.json # 250 country reference (UN ISO)
├── migrations/
│   ├── 0_init/                                              # baseline
│   ├── 1_add_admin_review_fields/                           # Sprint 0
│   ├── 2_split_countries_into_reference_and_pages/          # Modul 1.5 — destructive split
│   ├── 3_add_email_template_description/                    # Modul 3 — additive column
│   ├── 4_expand_settings_columns/                           # Modul 4 — 13 additive columns
│   └── 5_expand_payment_page_config_columns/                # Modul 5 — 8 additive columns
└── migration_lock.toml
```

**Frontend:**
```
src/
├── app/
│   ├── layout.tsx                    # Root + providers
│   ├── globals.css                   # Tailwind 4 + design tokens
│   ├── (public)/                     # Public route group (no auth)
│   │   ├── layout.tsx                # Public header/footer
│   │   ├── page.tsx                  # Landing — hero + selection flow
│   │   ├── about / contact / faq / privacy / terms /
│   │   ├── country/[slug]/page.tsx   # Public country detail (consumes /public/countryPages/:slug)
│   │   ├── apply/                    # Multi-step apply flow
│   │   │   ├── page.tsx              # Form
│   │   │   ├── review/page.tsx       # Review
│   │   │   └── success/page.tsx      # Success
│   │   ├── payment/page.tsx          # Pay flow
│   │   ├── resume/[token]/page.tsx   # Resume draft via tokenized link
│   │   ├── track/page.tsx            # Public tracking
│   │   └── me/page.tsx               # Portal user dashboard
│   └── admin/
│       ├── layout.tsx                # Sidebar + auth guard + permission-gated nav
│       ├── login/page.tsx
│       ├── page.tsx                  # Dashboard
│       ├── applications/
│       │   ├── page.tsx              # Application list
│       │   └── [id]/page.tsx         # Application detail
│       ├── transactions/page.tsx     # Payment list
│       ├── countries/page.tsx        # Modul 1.5 reference list (250 rows)
│       ├── country-pages/
│       │   ├── page.tsx              # Modul 1.5 publishable pages
│       │   └── [id]/page.tsx         # Edit + sections
│       ├── visa-types/page.tsx       # Modul 2 CRUD
│       ├── templates/                # Templates (Modul 7 pending — minimal stub)
│       │   └── [id]/page.tsx
│       ├── template-bindings/page.tsx # Bindings (Modul 8 pending)
│       ├── email-templates/page.tsx  # Modul 3 CRUD
│       ├── payment-page-builder/page.tsx # Modul 5 (3 tabs)
│       ├── settings/page.tsx         # Modul 4 (7 tabs)
│       ├── users/page.tsx            # Modul 6a CRUD + system protect
│       └── roles/page.tsx            # Modul 6a CRUD + system protect
├── components/
│   ├── admin/                        # PageHeader, DataTableCard, EmptyState, StatusBadge
│   ├── forms/                        # Multi-step apply form components
│   ├── providers/                    # QueryProvider, ToastProvider
│   ├── shared/
│   └── ui/                           # Radix-based primitives (Button, Dialog, AlertDialog, …)
└── lib/
    ├── api/
    │   ├── client.ts                 # ApiResponse<T> envelope, JWT refresh interceptor
    │   ├── admin.ts                  # adminApi.* (90+ methods, fully typed)
    │   ├── portal.ts                 # portalApi.* (OTP, applications, documents)
    │   └── public.ts                 # publicApi.* (selection, country pages, tracking)
    ├── hooks/
    │   └── useApi.ts                 # ~50 TanStack Query hooks (one per resource × verb)
    ├── stores/
    │   ├── admin-auth.ts             # Zustand + persist (token, AdminAuthUser)
    │   ├── portal-auth.ts            # Portal OTP session
    │   └── application.ts            # Multi-step apply form state
    ├── types/
    │   └── index.ts                  # All entity interfaces (AdminUser, Role, Permission, …)
    ├── config/
    └── utils/
```

---

## 2. HAZIRKI VƏZİYYƏT

### ✅ Tam hazır funksiyalar (Sprint 0–3)

| Modul | Backend | Frontend | İz |
|-------|---------|----------|-----|
| **Sprint 0** Admin review (approve/reject/request-docs/start-review) | ✅ | ✅ | `applications` module + `[id]/page.tsx` |
| **Sprint 2** Live SMTP (Resend port 587 STARTTLS) | ✅ | — | `email/email.service.ts` + `.env SMTP_*` |
| **Modul 1** Countries CRUD (initial) | ✅ | ✅ | Sonradan 1.5-də split olundu |
| **Modul 1.5** Countries split (Country reference + CountryPage publishable) | ✅ migration 2 | ✅ | Public `/public/countryPages/:slug`, admin override yalnız reference field-ləri |
| **Modul 2** Visa Types CRUD (purpose × entries unique) | ✅ | ✅ | DTO snake_case regex + cross-field validator + audit |
| **Modul 3** Email Templates CRUD + system protection | ✅ migration 3 | ✅ | 5 system key (otp_verification, application_status_update, generic_notification, payment_confirmation, raw_email) — silinə bilməz, key rename blok |
| **Modul 4** Settings singleton (18 field, 7 tab) | ✅ migration 4 | ✅ | General/Payment/Email/Application/Maintenance/Branding/Legal |
| **Modul 5** PaymentPageConfig singleton (11 field, 3 tab) | ✅ migration 5 | ✅ | Content/Layout/Behavior + sectionsJson forward-compat slot |
| **Modul 6a** Users + Roles + Permissions UAM (CRUD, system protect, audit) | ✅ no migration | ✅ | Schema artıq kompletdir; super-admin user/role qoruması, lowercase.dot audit |

### 🟡 Yarımçıq funksiyalar (sonrakı sprint-lərə qoyulmuş)

**Modul 6b** — Permission matrix UI-ları (~2 saat sabah üçün):
- ❌ `/admin/users/[id]` detail səhifəsi (profile + sessions + Edit Permissions link)
- ❌ `/admin/users/[id]/permissions` granular override matrix (51 perm × 3-state radio: inherit/allow/deny + reset to defaults)
- ❌ `/admin/roles/[id]/permissions` role permission matrix (51 × checkbox)
- ❌ `useAdminUserSessions`, `useRevokeSession` hooks
- ❌ Sessions backend endpoint (yoxsa Modul 6b PHASE B-də əlavə)
- ✅ Backend hazırdır: `GET /admin/permissions/users/:id` (effective perms), `PATCH /admin/permissions/roles/:id/permissions`, `PATCH /admin/permissions/users/:id/permissions`

**Modul 7** — Templates / FormBuilder (ən kompleks, sonuncu):
- ❌ `templates/`, `templateSections/`, `templateFields/` modulları audit + system protect əlavəsi
- ❌ `/admin/templates/[id]/page.tsx` builder UI tam yenidən yazılmalı (drag-drop sections + fields)
- 🟡 Backend modullar hazırdır amma audit logging + system protect əlavə olunmalıdır
- ⚠️ `formRenderer` Sprint 7-də mövcud Template-i public apply flow-a bind edir

**Modul 8** — Template Bindings + Nationality Fees:
- ❌ `/admin/template-bindings/page.tsx` tam mock-dur (audit qarşıdakı sprintdə)
- 🟡 Backend `templateBindings/` + `bindingNationalityFees/` mövcuddur, audit + UAM patterns əlavə olunmalı

**Sprint 4** — Runtime cutover işləri (artıq şimdiki Settings/PaymentPageConfig hazırdır, runtime-a wire olunmalıdır):
- 🟡 `Settings.smtpFromAddress` + `smtpFromName` runtime-da `email/email.service.ts`-ə oxutdurulmalıdır (hal-hazırda `.env`-dən oxunur)
- 🟡 `Settings.applicationCodeFormat` runtime-da application code generator-a oxutdurulmalıdır (hal-hazırda hardcoded)
- 🟡 `Settings.maintenanceMode` + `maintenanceMessage` public layout-da banner kimi göstərilməlidir
- 🟡 `Settings.logoUrl` public + admin header-də göstərilməlidir
- 🟡 `Settings.faviconUrl` `app/layout.tsx`-də metadata kimi
- 🟡 `Settings.googleAnalyticsId` `app/layout.tsx` script tag
- 🟡 `Settings.termsUrl` / `privacyUrl` footer link-lərində
- 🟡 `PaymentPageConfig.*` public `payment/page.tsx`-də render olunmalıdır

### Bilinən bug-lar və TODO

**Backend TODOs (canlı kod kommentlərindən):**
- `src/common/guards/roles.guard.ts:10` — "TODO: Implement actual role checking logic" (PermissionsGuard işlədiyi üçün roles.guard heç istifadə olunmur — silinə bilər)
- `src/modules/notifications/notifications.service.ts:213,249,307` — "TODO [FUTURE QUEUE INTEGRATION]" (BullMQ inteqrasiyası Sprint 5/6-da)

**DB sync seed məsələsi (kiçik, Modul 6 zamanı aşkar):**
- DB-də 53 permission var, seed-də 51 (Modul 4 + 5 deploy zamanı `paymentPageConfigs.read/update` əlavə olunub amma seed re-run olunmayıb)
- superAdmin role 51/53 perm-ə sahibdir. Düzəltmək: `npm run prisma:seed` re-run et (idempotent upsert) yaxud Modul 6b matrix UI-dan superAdmin-ə eksik 2 perm əlavə et

**Açıq xəbərdarlıq mesajları:**
- Frontend Next.js prerender warning: `ReferenceError: location is not defined` (dynamic route-larda — pre-existing, build green-dir)
- Frontend ESLint: ~50 errors / ~100 warnings — pre-existing, build keçir (Next.js ESLint default ignoreDuringBuilds yox amma `as any` cast-lar konvensiya, build crashing yox)

**Təhlükəsizlik artıfaktı (rotation lazım):**
- `feedback_evisa_secrets_exposed.md` (memory file) — production .env Sprint 2-də chat-də paylaşılıb. Rotation tapşırığı Sprint 1 / Task 1-də. DB password və 4 JWT secret rotate olunmalıdır.

---

## 3. ARXİTEKTURA

### Backend nümunə (Modul N pattern stabil)

Hər domain modulu eyni şablona sadiq:

```
modules/<entity>/
├── <entity>.module.ts          # imports: [AuditLogsModule, ...], providers, controllers
├── <entity>.controller.ts      # @ApiBearerAuth + @UseGuards(JwtAuthGuard) class-level
│                                 # hər endpoint @RequirePermissions('entity.action')
│                                 # POST/PATCH/DELETE @CurrentUser() inject
├── <entity>.service.ts         # constructor: PrismaService + AuditLogsService
│                                 # CRUD methods qəbul edir actorUserId? parameter
│                                 # Audit: logAdminAction(actor, 'entity.create', 'Entity', id, oldValue, newValue)
│                                 # System protection (varsa) — constants.ts faylından
└── dto/
    ├── create-<entity>.dto.ts  # class-validator + class-transformer + @ApiProperty
    ├── update-<entity>.dto.ts  # PartialType yaxud manual
    ├── get-<entity>s-query.dto.ts  # extends PaginationQueryDto + @Max(500) override + sortBy default
    └── <entity>-response.dto.ts
```

**Audit action key konvensiyası:** `lowercase.dot` (məs. `country.update`, `visaType.create`, `user.permissions.update`). Modul 6a-da `USER_CREATED` UPPERCASE_SNAKE format `user.create`-ə migrate edildi.

**Pagination DTO konvensiyası (Modul 2 dərsindən):**
```typescript
@ApiPropertyOptional({ minimum: 1, maximum: 500, default: 50 })
@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
limit?: number = 50;

// sortBy + sortOrder DTO-da default override edilməlidir, service destructure default
// parent PaginationQueryDto.sortOrder='desc' tərəfindən shadow olunur
```

**System protection pattern (Modul 3-də başladı, 6a-da formalaşdı):**
- Modul daxilindəki `<module>.constants.ts` faylında `SYSTEM_*_KEYS` const + `is*()` helper
- Service guard: `if (isSystemX(entity.key)) throw new ConflictException(...)`
- Response DTO `isSystem`/`isSuperAdmin` flag çıxarır → frontend Lock badge + disabled controls

**Conflict semantic (uniform):**
```json
{
  "success": false,
  "error": {
    "code": "conflict",
    "message": "...",
    "details": [{ "field": "key", "reason": "conflict", "message": "..." }]
  }
}
```

### Backend modullarının bir-birinə bağlılığı (yüksək səviyyə)

```
PrismaModule (singleton)
    ↑
AccessControlModule (checkPermission, getUserPermissions)
    ↑
AuditLogsModule (logAdminAction, logSystemAction)
    ↑
[Auth, Users, Roles, Permissions, Sessions, Countries, ... 30+ domain modules]
    ↑
AppModule (root)
```

### Frontend strukturu

**Routing (App Router):**
- `/admin/*` — `(admin)` group, sidebar + auth guard, permission-gated nav
- `/(public)/*` — public route group, header/footer
- `/admin/login` — login route bypasses auth guard

**State management:**
| Concern | Tool |
|---------|------|
| Server state | TanStack Query 5 (`lib/hooks/useApi.ts` — bütün hook-lar burada) |
| Client/auth state | Zustand 5 with `persist` middleware (`lib/stores/admin-auth.ts`) |
| Multi-step form state | Zustand (`lib/stores/application.ts`) |
| Form local state | React Hook Form 7.74 + Zod 4 |
| URL state | Next.js searchParams |

**Auth flow (admin):**
1. `/admin/login` → `adminApi.login(email, password)` → POST `/api/v1/admin/auth/login`
2. Backend response: `{ accessToken, refreshToken, expiresInSeconds, user: { id, fullName, email, roleKey, isSuperAdmin, permissions[] } }`
3. Zustand store persist edir → cookies/localStorage
4. `apiClient.setToken(accessToken, "admin")` → bütün sonrakı requestlərə `Authorization: Bearer ...` əlavə olunur
5. `useAdminAuth().hasPermission('users.create')` UI-da gating üçün
6. 401 yaxalananda `apiClient` avtomatik `refreshToken` ilə yeniləyir (interceptor)

**Auth flow (portal):**
- Public users `/portal/auth/otp/send` → email-ə kod, `/verify` → JWT pair (ayrı PortalIdentity table)

### İstifadə olunan xarici servislər

| Servis | İstifadə | Konfiqurasiya |
|--------|----------|---------------|
| **Resend** | Transactional email (SMTP) | `.env SMTP_HOST=smtp.resend.com`, port 587 STARTTLS, domain evisaglobal.com verified |
| **Hetzner Cloud** | Serverless VM (Ubuntu) | IP 46.224.16.161, SSH port 22 (fail2ban) |
| **GitHub** | Source control (backend yalnız) | `github.com/Ismayilbaylianar/e-visa_portal_backend_dev` |
| **PostgreSQL 16** | DB | local on server, password rotate olunmalıdır (Sprint 1) |

**İstifadə olunmur (qeyd üçün):**
- ❌ Stripe — payments backend mövcuddur amma provider hələ wire olunmayıb (Sprint 4)
- ❌ Supabase / Firebase — yalnız Postgres + Hetzner
- ❌ Sentry / DataDog — yalnız pm2 logs

---

## 4. SON DƏYİŞİKLİKLƏR

### Son 15 commit (`git log --oneline -15`)

```
80fcd74 feat(uam): harden Users + Roles + Permissions for Modul 6a
96ae737 feat(admin): expand PaymentPageConfig singleton + audit on update
ba410f8 fix(brand): align brand strings, remove dreamsparrow.io accident
ae631e1 feat(admin): expand Settings singleton + audit on update
73399be feat(admin): wire EmailTemplates CRUD with audit + system protection
a554d45 fix(visaTypes): override pagination limit max to 500
15967c2 feat(admin): wire VisaTypes CRUD with audit + in-use check
5b490ce fix(countries,countryPages): default sortOrder asc on reference + page lists
7212a12 fix(countries,country-pages): allow limit up to 500 on reference list endpoints
5213c60 feat(admin): wire CountryPage CRUD with audit + cascade soft-delete
b6f8ca4 refactor(country): split countries into reference and country_pages
58ab643 feat(data): add UN ISO 3166-1 country reference data (250 countries)
4ed73b9 feat(auth): include permissions in login + refresh response
3bc2bfe fix(countries): use class-level JwtAuthGuard to fix decorator order regression
3f659a0 feat(admin): wire Countries CRUD with audit logging and delete-in-use check
```

### Son aktiv işlənən modul: **Modul 6a — Users + Roles + Permissions UAM**

Yeni / dəyişən fayllar (commit 80fcd74):
- **Backend (15 fayl):**
  - `src/modules/accessControl/system-protection.constants.ts` (yeni)
  - `src/modules/accessControl/index.ts` (export)
  - `src/modules/users/{controller,service,module}.ts` (audit lowercase.dot, super-protect, self-modify guard)
  - `src/modules/users/dto/{user-response,get-users-query}.dto.ts` (isSuperAdmin field, @Max(500))
  - `src/modules/roles/{controller,service,module}.ts` (audit, system rename block)
  - `src/modules/roles/dto/get-roles-query.dto.ts` (@Max(500))
  - `src/modules/permissions/{controller,service,module}.ts` (audit, super-system protect, GET user effective perms)
  - `src/modules/permissions/dto/{user-effective-permissions,index}.ts` (yeni DTO)
- **Frontend (6 fayl):**
  - `src/lib/types/index.ts` (AdminUser refactor, Role + Permission interfaces, AdminAuthUser back-compat)
  - `src/lib/api/admin.ts` (CreateUserInput/UpdateRoleInput typed inputs, 14 yeni method)
  - `src/lib/hooks/useApi.ts` (~14 yeni hook)
  - `src/lib/stores/admin-auth.ts` (AdminUser → AdminAuthUser)
  - `src/app/admin/users/page.tsx` (TAM REWRITE — mock SİL, real CRUD modal, system protect UI)
  - `src/app/admin/roles/page.tsx` (YENİ — CRUD modal, system role protect)
  - `src/app/admin/layout.tsx` (sidebar permission gating + Roles link + fullName fallback)

### Son uğurlu deploy

| Komponent | Versiya | Tarix | Status |
|-----------|---------|-------|--------|
| Backend pm2 | commit `80fcd74` | 2026-05-02 | online, "Application is running on http://localhost:3000/api/v1" |
| Frontend pm2 | rsync (no git) | 2026-05-02 | online, "Ready in 140ms" — `/admin/users` + `/admin/roles` HTTP 200 |
| DB migrations | 5/5 applied | — | last: `5_expand_payment_page_config_columns` |

---

## 5. NÖVBƏTI ADDIMLAR (priority sırası ilə)

### 🔴 P0 — Modul 6a browser test (sənin gözləyən iş, ~10-15 dəq)

7-step browser test plan əvvəlki turn-də verildi. Anar incognito-da yoxlamalıdır:
1. Super login → /admin/users (real data, mock yox, sidebar Roles görünür)
2. Add User modal → operator yarat
3. Edit user role
4. Delete custom user
5. Super user protection (Delete + Status disabled, Lock badge)
6. /admin/roles CRUD + system role validation
7. Operator login (sidebar gating: Roles link YOX, Settings YOX, Add User YOX)

**Toxunulan fayllar:** browser-də yalnız test, kod dəyişiklik yoxdur.

### 🟠 P1 — Modul 6b (sabah, ~2 saat)

**Toxunulan backend fayllar:** (yalnız sessions üçün, qalanı hazırdır)
- `src/modules/sessions/sessions.controller.ts` — yox isə `GET /admin/users/:id/sessions` + `DELETE /admin/sessions/:id` əlavə et
- `src/modules/sessions/sessions.service.ts`

**Yeni frontend fayllar:**
- `src/app/admin/users/[id]/page.tsx` — detail (profile + sessions + Edit Permissions link)
- `src/app/admin/users/[id]/permissions/page.tsx` — granular override matrix (3-state radio per perm × 51 perm grouped by 18 module)
- `src/app/admin/roles/[id]/page.tsx` — role detail (optional, Edit Permissions link kifayətdir)
- `src/app/admin/roles/[id]/permissions/page.tsx` — role perm matrix (51 × checkbox grouped by module)

**useApi.ts-ə əlavə hook-lar:**
- `useAdminUserSessions(userId)`, `useRevokeSession(sessionId)`
- (`useUserEffectivePermissions` + `useUpdateRolePermissions` + `useUpdateUserPermissions` artıq Modul 6a-da yazılıb)

**Backend-də artıq hazırdır:**
- `GET /admin/permissions/users/:id` → `UserEffectivePermissionsResponseDto` (51 perm × `{fromRole, override, effective}`)
- `PATCH /admin/permissions/roles/:id/permissions` (super-admin role locked)
- `PATCH /admin/permissions/users/:id/permissions` (super-admin user locked)
- `GET /admin/permissions/matrix` (modules × roles)

### 🟡 P2 — Modul 7: Templates / FormBuilder (~4-6 saat, ən kompleks)

**Backend:**
- `src/modules/templates/{controller,service,module}.ts` — class-level guards, audit, @CurrentUser, system protect (varsa)
- `src/modules/templateSections/{,nested under templates routing}`
- `src/modules/templateFields/{,nested under sections}`
- DTO regex `templateKey` snake_case (Modul 3 pattern), validation
- Migration ehtimalı: schema artıq mövcuddur, yox

**Frontend:**
- `src/app/admin/templates/page.tsx` — Modul 2 pattern (CRUD list)
- `src/app/admin/templates/[id]/page.tsx` — TAM rewrite: drag-drop section + field builder
  - Library: `@dnd-kit/sortable` (artıq package.json-da yoxdur, yenisi əlavə olunur)
  - Section + field tipleri (text, email, date, select, file, textarea, checkbox)
  - Live preview panel (sağda, formRenderer-i embed)
- `src/lib/types/index.ts` — TemplateSection, TemplateField types

### 🟢 P3 — Modul 8: Template Bindings + Nationality Fees (~2 saat)

**Backend:**
- `templateBindings/` + `bindingNationalityFees/` audit + UAM patterns
- DTO conflict semantic (template + visa type + country compound unique)

**Frontend:**
- `src/app/admin/template-bindings/page.tsx` TAM rewrite (mock-dur)
- Per-nationality fee override matrix UI

### 🔵 P4 — Sprint 4: Runtime cutover (Settings + PaymentPageConfig DB-dən oxutdurulması)

Toxunulan fayllar:
- `src/modules/email/email.service.ts` — `Settings.smtpFromAddress` oxu
- `src/modules/applications/applications.service.ts` — `Settings.applicationCodeFormat` oxu (yaxud `code-generator.service.ts` yarat)
- `src/app/(public)/layout.tsx` — `Settings.maintenanceMode` banner + `logoUrl` header
- `src/app/admin/layout.tsx` — `Settings.logoUrl` + `siteName` header
- `src/app/layout.tsx` — `Settings.faviconUrl` metadata + `googleAnalyticsId` script
- `src/app/(public)/payment/page.tsx` — `PaymentPageConfig.*` render

### 🟣 P5 — Sprint 1 / Task 1: Production secrets rotation

Sprint 2 zamanı `.env` chat-də paylaşılıb. Rotate ediləcək:
- DB password (`Wolvex*1385`)
- 4 JWT secret (admin access + admin refresh + portal access + portal refresh)

Toxunulan fayllar:
- Server-də `/var/www/evisa-backend/app/.env`
- pm2 restart sonra
- Sessions table-da bütün mövcud session-ları revoke et (force re-login)

---

## 🛠 İnfrastruktur cheat-sheet

### SSH access
```bash
ssh -i ~/.ssh/claude_code_ed25519 -o IdentitiesOnly=yes anar@46.224.16.161
```

### Server-də vacib yollar
- Backend: `/var/www/evisa-backend/app/` (git tracked)
- Frontend: `/home/anar/evisa-frontend/` (rsync target)
- DB backups: `/home/anar/db-backups/pre_module_*.sql.gz`
- Backend logs: `/var/log/evisa/{out,error}.log` (pm2-logrotate)
- Uploads: `/var/www/evisa-backend/uploads/`

### Backend deploy (mənim icra etdiyim pattern)
```bash
ssh anar@46.224.16.161
cd /var/www/evisa-backend/app
git pull origin main
npx prisma migrate deploy   # əgər yeni migration varsa
npx prisma generate         # əgər schema dəyişibsə
npm run build
pm2 restart evisa-backend
sleep 4
pm2 logs evisa-backend --lines 20 --nostream | grep "Application is running"
```

### Frontend deploy (Mac-dən rsync + server-də rebuild)
```bash
# Mac-dən:
cd /Users/anarismayilbayli/Desktop/e-visa-portal-frontend
rsync -avz --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.env*' \
  -e "ssh -i ~/.ssh/claude_code_ed25519 -o IdentitiesOnly=yes" \
  ./ anar@46.224.16.161:/home/anar/evisa-frontend/

# Sonra server-də:
ssh anar@46.224.16.161
cd /home/anar/evisa-frontend
pm2 stop evisa-frontend
rm -rf .next
npm run build
pm2 start evisa-frontend
```

### DB backup (hər migration-dan əvvəl mütləq)
```bash
TS=$(date +%Y%m%d_%H%M%S)
DB_URL=$(grep '^DATABASE_URL=' /var/www/evisa-backend/app/.env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
pg_dump "$DB_URL" --no-owner --no-acl | gzip > /home/anar/db-backups/pre_module_X_$TS.sql.gz
```

### Seeded admin users (development)
| Email | Password | Role |
|-------|----------|------|
| super@visa.com | super123 | superAdmin (51/53 permissions) |
| admin@visa.com | admin123 | admin (~30 permissions) |
| operator@visa.com | operator123 | operator (~10 permissions, mostly read) |

### Localhost API base
- Backend: `http://localhost:3000/api/v1`
- Frontend: `http://localhost:3001`
- Swagger docs: `http://localhost:3000/docs` (yalnız local)

---

## 🎓 Mövcud konvensiyalar (Modul N pattern stabil)

| Konvensiya | Niyə |
|------------|------|
| Audit action key `lowercase.dot` (məs `user.create`) | Audit log filterləri group by `entity.*` |
| `@Max(500)` pagination override hər list DTO-da | Frontend `limit=200` standart, parent `MAX_LIMIT=100` 400 verir |
| Class-level `@UseGuards(JwtAuthGuard)` | Method-level decorator order bug-u (PermissionsGuard JwtAuthGuard-dan əvvəl run olur → 403) |
| `@CurrentUser()` POST/PATCH/DELETE-də inject | actorUserId audit log-a forward |
| `is*()` helper + `<MODULE>_KEYS` const file | System protection — single source of truth, runtime fetch race yoxdur |
| Snake_case regex (`^[a-z]+(?:_[a-z]+)*$`) machine keys üçün | URL-safe, code-də hardcoded literallarla uyğun |
| Frontend Modul 2 modal pattern | Konsistent CRUD UX (Add Dialog + Edit Dialog + AlertDialog Delete) |
| Frontend `data?.items ?? []` defensive empty state | Mock fallback heç bir yerdə yox (Modul 3 dərsi) |
| `useAdminAuth().hasPermission(key)` permission gating | Sidebar + button visibility |
| Migration faylları additive only (no DROP) | Live DB-yə zero-downtime apply |
| Generic dev fallback brand strings ("Visa Portal") | Real "E-Visa Global" yalnız user-facing UI yaxud DB-də saxlanır |

---

## 📚 Əlavə oxu

- **Backend GitHub:** `github.com/Ismayilbaylianar/e-visa_portal_backend_dev` (yalnız main branch)
- **Frontend:** lokal Mac-də, **GitHub-da yoxdur**, deploy yalnız rsync ilə
- **Memory faylları:** `~/.claude/projects/-Users-anarismayilbayli-CloudeCode/memory/MEMORY.md` (user profile + project notes + secrets exposed flag)
- **Sprint planları:** mövcud chat history-də `EVISA-CLAUDE-CODE-PROMPTS.md` + `HANDOVER.md`

---

> **Müəllif:** Anar Ismayilbayli
> **Bu sənəd:** Modul 6a tamamlanma noktasında snapshot. Modul 6b başlayanda mütləq yenilə.
