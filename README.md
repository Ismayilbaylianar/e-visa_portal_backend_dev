# E-Visa Portal Backend

Production-ready backend API for an online visa application portal built with NestJS, Prisma, and PostgreSQL.

## Current Stage: Notifications, Jobs, Audit Logs & Dashboard

This repository contains the complete backend architecture with fully functional IAM, Configuration, Form Builder, Template Binding, Portal Auth, Applications, Documents, Tracking, Payments, Notifications, Jobs, Audit Logs, and Dashboard layers.

### What's Implemented

#### Core Infrastructure
- [x] NestJS application with modular architecture
- [x] Prisma ORM with PostgreSQL
- [x] Global API prefix (`/api/v1`)
- [x] Unified response/error format
- [x] Global validation pipe
- [x] Request ID generation and propagation
- [x] Global exception filter
- [x] Swagger/OpenAPI documentation at `/docs`
- [x] Docker development setup
- [x] Environment configuration

#### Identity & Access Management (Fully Functional)
- [x] JWT-based admin authentication
- [x] Session management with database persistence
- [x] User management (CRUD + status)
- [x] Role management (CRUD + system role protection)
- [x] Permission management (list, matrix, assignments)
- [x] Access control guards and decorators

#### Configuration Modules (Fully Functional)
- [x] **Countries**
  - Admin CRUD with sections
  - Public endpoints for published countries
  - Soft delete support
  - SEO fields (title, description)
- [x] **Country Sections**
  - Create/update/delete sections for countries
  - Sort order and active status
- [x] **Visa Types**
  - Admin CRUD
  - Public endpoint for active types
  - Entry type (single/double/multiple)
  - Validity and max stay configuration
- [x] **Settings**
  - Singleton configuration
  - Site name, support email, currency
  - Payment timeout, maintenance mode
  - Auto-creates defaults if none exist
- [x] **Email Templates**
  - Admin CRUD
  - Template key uniqueness
  - HTML and plain text body
  - Template variable support (e.g., `{{fullName}}`)
- [x] **Payment Page Configs**
  - Singleton configuration
  - JSON-based sections configuration
  - Auto-creates defaults if none exist

#### Form Builder Modules (Fully Functional)
- [x] **Templates**
  - Admin CRUD for form templates
  - Unique key constraint
  - Version field (initialized to 1, not auto-incremented)
  - Soft delete with cascade to sections and fields
  - List endpoint returns summary (without nested data)
  - Detail endpoint returns fully nested structure
- [x] **Template Sections**
  - Create/update/delete sections within templates
  - Section key unique within template
  - Sort order for display ordering
  - Soft delete with cascade to fields
- [x] **Template Fields**
  - Create/update/delete fields within sections
  - **fieldKey unique within entire template** (future-safe for form data handling)
  - Supported field types: `text`, `textarea`, `select`, `radio`, `checkbox`, `date`, `file`, `email`, `phone`, `number`
  - Options JSON for select/radio/checkbox fields
  - Validation rules JSON (minLength, maxLength, pattern, allowedFileTypes, maxFileSizeMb, etc.)
  - Visibility rules JSON for conditional field display
  - Sort order for display ordering

#### Template Bindings & Fees (Fully Functional)
- [x] **Template Bindings**
  - Admin CRUD for linking destination country + visa type + template
  - Duplicate prevention: only one binding per destination + visa type
  - Date validity support (validFrom, validTo)
  - Soft delete with cascade to nationality fees
  - List endpoint with filtering (destinationCountryId, visaTypeId, templateId, isActive)
  - Detail endpoint includes nested nationality fees
- [x] **Binding Nationality Fees**
  - Create/update/delete fees per nationality within a binding
  - Nationality unique within binding
  - Government fee, service fee, expedited fee (optional)
  - Currency code (ISO 4217)
  - Expedited enabled flag
  - Soft delete support
- [x] **Public Selection**
  - GET options: destination countries, nationality countries, visa types
  - POST preview: fee breakdown for nationality + destination + visa type
  - Date validity matching (validFrom/validTo)
  - Returns bindingId, templateId, and fee preview

#### Portal Authentication (Fully Functional)
- [x] **Portal Auth**
  - OTP-based authentication (no password)
  - Send OTP to email (development mode returns OTP in response)
  - Verify OTP and receive JWT tokens
  - Token refresh with rotation
  - Logout (revoke session)
  - Portal identity auto-creation on first login
- [x] **Portal Sessions**
  - Database-backed session management
  - Refresh token hashing
  - Session revocation
  - Expiration tracking

#### Applications & Applicants (Fully Functional)
- [x] **Applications**
  - Portal: Create application with binding validation
  - Portal: View own applications
  - Portal: Update draft applications
  - Portal: Submit for review (requires at least one applicant)
  - Portal: Submit for processing (temporary: allows without payment)
  - Portal: Resume application by token
  - Admin: List all applications with filters
  - Admin: View application details
  - Resume token generation
  - Payment deadline initialization
- [x] **Applicants**
  - Portal: Add applicants to draft applications
  - Portal: Update applicant details
  - Portal: Delete applicants (soft delete)
  - Main applicant rule: only one per application
  - Form data stored as JSON
  - Editable only while application is in DRAFT status
  - **Application code auto-generated on creation** (format: APP-YYYY-NNNNNN)
- [x] **Customer Portal**
  - Get my applications list

#### Form Renderer (Fully Functional)
- [x] **Form Schema Endpoint**
  - GET schema by templateBindingId, applicationId, or applicantId
  - Flexible resolution logic with ownership verification
  - Returns nested sections and fields ordered by sortOrder
  - Includes all field metadata (validationRulesJson, visibilityRulesJson, optionsJson)

#### Documents (Fully Functional)
- [x] **Document Upload**
  - Multipart file upload with local filesystem storage
  - File validation (size: max 10MB, types: PDF, JPEG, PNG)
  - Safe filename generation (random hex)
  - Ownership verification through applicant
  - Only allowed for DRAFT applications
- [x] **Document Management**
  - Portal: List documents by applicant
  - Portal: Get document details
  - Portal: Delete document (soft delete)
  - Admin: Review document (approve/reject)
- [x] **Review Status**
  - PENDING, APPROVED, REJECTED, NEEDS_REUPLOAD

#### Public Tracking (Fully Functional)
- [x] **Application Tracking**
  - Search by email + applicationCode
  - Returns current status and status history
  - Result file availability flag
  - No authentication required

#### Status Workflow (Fully Functional)
- [x] **Transition Management**
  - Central status transition service
  - Application, Applicant, and Payment status maps
  - Admin endpoint to query allowed transitions
  - Validation methods for status changes

#### Payments (Fully Functional)
- [x] **Payment Provider Abstraction**
  - Clean provider interface for multiple payment gateways
  - Mock provider for development and testing
  - Ready for real provider integration (Stripe, PayPal, etc.)
- [x] **Portal Payment Endpoints**
  - Create payment for application (fee snapshot)
  - Initialize payment with provider (get redirect URL)
  - Get payment details
  - Duplicate payment prevention
- [x] **Admin Payment Endpoints**
  - List all payments with filters
  - Get payment details with transactions/callbacks
  - Manual status update with audit trail
  - View payment transactions
  - View payment callbacks
- [x] **Public Callback Endpoint**
  - Receive provider webhooks
  - Store raw headers and payload
  - Validate callback signature (when applicable)
  - Auto-update payment status
- [x] **Payment Transactions**
  - Track all payment lifecycle events
  - Initialization, callback, status update records
  - Internal and provider transaction references
- [x] **Payment Status History**
  - Full audit trail of status changes
  - System vs admin changes tracked
  - Change reason/note storage
- [x] **Payment Reconciliation**
  - Structure for provider settlement checks
  - Amount matching validation
  - Ready for future reconciliation workflows

#### Email Infrastructure (Production-Ready)
- [x] **Provider-Agnostic Architecture**
  - Email provider abstraction interface
  - SmtpEmailProvider for real SMTP sending
  - ConsoleEmailProvider for development/testing
  - Environment-based provider selection (auto/smtp/console)
  - Configuration validation on startup (fail-fast in production)
- [x] **Template-Based Sending**
  - Database templates via EmailTemplate model
  - Built-in default templates (OTP, notifications, status updates, invites, payments)
  - Variable substitution with `{{variable}}` syntax
  - Simple conditional blocks `{{#if variable}}...{{/if}}`
  - Required variable validation with clear error messages
- [x] **OTP Email Delivery (Hardened)**
  - Real email sending for OTP codes
  - Resend cooldown protection (configurable, default 60s)
  - Hourly rate limiting (configurable, default 10 attempts)
  - Graceful fallback if email fails (OTP still valid)
  - Development mode still returns OTP in response
- [x] **Notification Email Integration**
  - EMAIL channel notifications use real SMTP
  - Robust state machine (PENDING → PROCESSING → SENT/FAILED)
  - Provider and messageId tracking
  - Configurable retry count per notification
  - Error tracking for failed deliveries
- [x] **Email Logging & Observability**
  - EmailLog table for all send attempts
  - Captures: template, recipient, provider, status, errors
  - Related entity tracking (OTP, Notification, etc.)
  - Admin endpoint for email statistics and failures
- [x] **Admin Utilities**
  - Test email endpoint (`POST /admin/email/test`)
  - Email status endpoint (`GET /admin/email/status`)
  - Statistics endpoint (`GET /admin/email/statistics`)
  - Failures endpoint (`GET /admin/email/failures`)
  - Config validation endpoint (`GET /admin/email/config/validate`)

#### Notifications (Fully Functional)
- [x] **Notification Management**
  - List notifications with filters (channel, status, templateKey, recipient)
  - Get notification details
  - Retry failed/pending notifications
  - Real EMAIL sending when SMTP configured, mock for SMS/PUSH
- [x] **Notification Status Tracking**
  - PENDING, PROCESSING, SENT, FAILED, DELIVERED statuses
  - Retry count tracking
  - Error message storage for failed deliveries

#### Jobs (Fully Functional)
- [x] **Background Job Management**
  - List jobs with filters (jobType, status)
  - Get job details with execution history
  - Retry failed/cancelled jobs
  - Cancel pending/running jobs
- [x] **Job Execution History**
  - Track all job execution attempts
  - Execution status and timestamps
  - Error tracking per execution

#### Audit Logs (Fully Functional)
- [x] **Audit Log Visibility**
  - List audit logs with filters (actorUserId, entityType, actionKey)
  - Get audit log details with old/new value JSON
  - Actor user information included
- [x] **Automatic Audit Logging**
  - User create/update/delete/status changes
  - Payment manual status updates
  - Ready for more entity types

#### Dashboard (Fully Functional)
- [x] **Summary Statistics**
  - Application counts by status
  - Payment counts by status
  - Portal and admin user counts
  - Total and daily revenue
- [x] **Charts Data**
  - Applications by status
  - Payments by status
  - Applications by destination country (top 10)
  - Revenue by month (last 6 months)
  - Daily application counts (last 30 days)

### What's NOT Implemented Yet

- [ ] Real payment provider integrations (Stripe, PayPal, etc.)
- [x] ~~Real SMTP email sending~~ - **Implemented via Email Infrastructure**
- [ ] Real SMS sending (SMS/PUSH channels still mock)
- [ ] Background job worker/processor
- [ ] S3/cloud storage
- [ ] External queue systems (Redis, etc.)
- [ ] Email delivery tracking/webhooks

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 16
- **Authentication**: JWT (passport-jwt)
- **Password Hashing**: bcrypt
- **Documentation**: Swagger/OpenAPI 7.x
- **Validation**: class-validator, class-transformer
- **Container**: Docker, Docker Compose

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- PostgreSQL 16+ (or Docker)
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd e-visa_portal_backend_dev

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npm run prisma:generate
```

### Database Setup

```bash
# Option 1: Push schema to database (development)
npm run db:push

# Option 2: Run migrations (production)
npm run prisma:migrate:dev

# Seed default data (roles, permissions, users)
npm run prisma:seed
```

### Running Locally

```bash
# Development mode with hot-reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Default Development Credentials

After running the seed script, these users are available:

| Email | Password | Role |
|-------|----------|------|
| `super@visa.com` | `super123` | Super Admin (all permissions) |
| `admin@visa.com` | `admin123` | Admin (most permissions) |
| `operator@visa.com` | `operator123` | Operator (limited permissions) |

**⚠️ Change these passwords in production!**

## Seeded Permissions

| Module | Actions |
|--------|---------|
| `users` | read, create, update, delete |
| `roles` | read, create, update, delete |
| `permissions` | read, update |
| `sessions` | read, delete |
| `countries` | read, create, update, delete |
| `visaTypes` | read, create, update, delete |
| `settings` | read, update |
| `emailTemplates` | read, create, update, delete |
| `paymentPageConfigs` | read, update |
| `templates` | read, create, update, delete |
| `templateBindings` | read, create, update, delete |
| `applications` | read, update, review |
| `payments` | read, update, refund, manage |
| `notifications` | read, update |
| `jobs` | read, update |
| `auditLogs` | read |
| `dashboard` | read |

## API Documentation

Once the application is running, access Swagger documentation at:

```
http://localhost:3000/docs
```

## API Endpoints

### Authentication
```
POST /api/v1/admin/auth/login
POST /api/v1/admin/auth/refresh
POST /api/v1/admin/auth/logout
```

### Sessions
```
GET    /api/v1/admin/sessions/me
DELETE /api/v1/admin/sessions/:sessionId
DELETE /api/v1/admin/sessions/revokeAll
```

### Users
```
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:userId
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId/status
DELETE /api/v1/admin/users/:userId
```

### Roles
```
GET    /api/v1/admin/roles
GET    /api/v1/admin/roles/:roleId
POST   /api/v1/admin/roles
PATCH  /api/v1/admin/roles/:roleId
DELETE /api/v1/admin/roles/:roleId
```

### Permissions
```
GET   /api/v1/admin/permissions
GET   /api/v1/admin/permissions/matrix
PATCH /api/v1/admin/permissions/roles/:roleId/permissions
PATCH /api/v1/admin/permissions/users/:userId/permissions
```

### Countries (Admin)
```
GET    /api/v1/admin/countries
GET    /api/v1/admin/countries/:countryId
POST   /api/v1/admin/countries
PATCH  /api/v1/admin/countries/:countryId
DELETE /api/v1/admin/countries/:countryId
POST   /api/v1/admin/countries/:countryId/sections
```

### Country Sections (Admin)
```
PATCH  /api/v1/admin/countrySections/:sectionId
DELETE /api/v1/admin/countrySections/:sectionId
```

### Countries (Public)
```
GET /api/v1/public/countries
GET /api/v1/public/countries/:slug
```

### Visa Types (Admin)
```
GET    /api/v1/admin/visaTypes
GET    /api/v1/admin/visaTypes/:visaTypeId
POST   /api/v1/admin/visaTypes
PATCH  /api/v1/admin/visaTypes/:visaTypeId
DELETE /api/v1/admin/visaTypes/:visaTypeId
```

### Visa Types (Public)
```
GET /api/v1/public/visaTypes
```

### Settings
```
GET   /api/v1/admin/settings
PATCH /api/v1/admin/settings
```

### Email Templates
```
GET    /api/v1/admin/emailTemplates
GET    /api/v1/admin/emailTemplates/:templateId
POST   /api/v1/admin/emailTemplates
PATCH  /api/v1/admin/emailTemplates/:templateId
DELETE /api/v1/admin/emailTemplates/:templateId
```

### Payment Page Config
```
GET   /api/v1/admin/paymentPageConfigs
PATCH /api/v1/admin/paymentPageConfigs
```

### Templates (Admin) - Form Builder
```
GET    /api/v1/admin/templates                    # List templates (paginated, summary)
GET    /api/v1/admin/templates/:templateId        # Get template with nested sections/fields
POST   /api/v1/admin/templates                    # Create template
PATCH  /api/v1/admin/templates/:templateId        # Update template
DELETE /api/v1/admin/templates/:templateId        # Soft delete template
```

### Template Sections (Admin)
```
POST   /api/v1/admin/templates/:templateId/sections  # Create section
PATCH  /api/v1/admin/templateSections/:sectionId     # Update section
DELETE /api/v1/admin/templateSections/:sectionId     # Soft delete section
```

### Template Fields (Admin)
```
POST   /api/v1/admin/templateSections/:sectionId/fields  # Create field
PATCH  /api/v1/admin/templateFields/:fieldId             # Update field
DELETE /api/v1/admin/templateFields/:fieldId             # Soft delete field
```

### Template Bindings (Admin)
```
GET    /api/v1/admin/templateBindings                    # List bindings (paginated, with filters)
GET    /api/v1/admin/templateBindings/:bindingId         # Get binding with nationality fees
POST   /api/v1/admin/templateBindings                    # Create binding
PATCH  /api/v1/admin/templateBindings/:bindingId         # Update binding
DELETE /api/v1/admin/templateBindings/:bindingId         # Soft delete binding + fees
```

### Binding Nationality Fees (Admin)
```
POST   /api/v1/admin/templateBindings/:bindingId/nationalityFees  # Create fee
PATCH  /api/v1/admin/bindingNationalityFees/:feeId                # Update fee
DELETE /api/v1/admin/bindingNationalityFees/:feeId                # Soft delete fee
```

### Public Selection (No Auth Required)
```
GET  /api/v1/public/selection/options   # Get destination countries, nationality countries, visa types
POST /api/v1/public/selection/preview   # Get fee preview for nationality + destination + visa type
```

### Portal Auth (No Auth Required for OTP endpoints)
```
POST /api/v1/portal/auth/sendOtp    # Send OTP to email
POST /api/v1/portal/auth/verifyOtp  # Verify OTP and get tokens
POST /api/v1/portal/auth/refresh    # Refresh access token
POST /api/v1/portal/auth/logout     # Logout (revoke session)
```

### Applications (Admin)
```
GET /api/v1/admin/applications                # List all applications (paginated, filtered)
GET /api/v1/admin/applications/:applicationId # Get application details
```

### Applications (Portal - Requires Portal Auth)
```
POST  /api/v1/portal/applications                        # Create application
GET   /api/v1/portal/me/applications/:applicationId      # Get my application
PATCH /api/v1/portal/applications/:applicationId         # Update draft application
POST  /api/v1/portal/applications/:applicationId/review  # Submit for review
POST  /api/v1/portal/applications/:applicationId/submit  # Submit for processing
GET   /api/v1/portal/applications/resume/:resumeToken    # Resume application
```

### Applicants (Portal - Requires Portal Auth)
```
GET    /api/v1/portal/applications/:applicationId/applicants  # List applicants
GET    /api/v1/portal/applicants/:applicantId                 # Get applicant
POST   /api/v1/portal/applications/:applicationId/applicants  # Create applicant
PATCH  /api/v1/portal/applicants/:applicantId                 # Update applicant
DELETE /api/v1/portal/applicants/:applicantId                 # Delete applicant
```

### Customer Portal (Portal - Requires Portal Auth)
```
GET /api/v1/portal/me/applications  # Get my applications list
```

### Form Renderer (Portal - Requires Portal Auth)
```
GET /api/v1/portal/forms/schema  # Get form schema (query: templateBindingId, applicationId, or applicantId)
```

### Documents (Portal - Requires Portal Auth)
```
GET    /api/v1/portal/applicants/:applicantId/documents  # List documents for applicant
POST   /api/v1/portal/documents/upload                   # Upload document (multipart)
GET    /api/v1/portal/documents/:documentId              # Get document details
DELETE /api/v1/portal/documents/:documentId              # Delete document (soft delete)
```

### Documents (Admin)
```
PATCH /api/v1/admin/documents/:documentId/review  # Review document (approve/reject)
```

### Public Tracking (No Auth Required)
```
POST /api/v1/public/tracking/search  # Search by email + applicationCode
```

### Status Workflow (Admin)
```
GET /api/v1/admin/statusWorkflow/transitions  # Get allowed transitions (query: entityType, currentStatus)
```

### Payments (Portal - Requires Portal Auth)
```
POST /api/v1/portal/payments                      # Create payment for application
POST /api/v1/portal/payments/:paymentId/initialize  # Initialize payment with provider
GET  /api/v1/portal/payments/:paymentId           # Get payment details
```

### Payments (Admin)
```
GET   /api/v1/admin/payments                          # List all payments (paginated, filtered)
GET   /api/v1/admin/payments/:paymentId               # Get payment details
GET   /api/v1/admin/payments/:paymentId/transactions  # Get payment transactions
GET   /api/v1/admin/payments/:paymentId/callbacks     # Get payment callbacks
PATCH /api/v1/admin/payments/:paymentId/status        # Update payment status manually
```

### Payment Callbacks (Public - No Auth)
```
POST /api/v1/public/paymentCallbacks/:providerKey  # Receive provider webhooks
```

### Notifications (Admin)
```
GET  /api/v1/admin/notifications                     # List notifications (paginated, filtered)
GET  /api/v1/admin/notifications/:notificationId     # Get notification details
POST /api/v1/admin/notifications/:notificationId/retry  # Retry failed/pending notification
```

### Jobs (Admin)
```
GET   /api/v1/admin/jobs                # List jobs (paginated, filtered)
GET   /api/v1/admin/jobs/:jobId         # Get job details with execution history
POST  /api/v1/admin/jobs/:jobId/retry   # Retry failed/cancelled job
PATCH /api/v1/admin/jobs/:jobId/cancel  # Cancel pending/running job
```

### Audit Logs (Admin)
```
GET /api/v1/admin/auditLogs               # List audit logs (paginated, filtered)
GET /api/v1/admin/auditLogs/:auditLogId   # Get audit log details
```

### Dashboard (Admin)
```
GET /api/v1/admin/dashboard/summary  # Get summary statistics
GET /api/v1/admin/dashboard/charts   # Get charts data
```

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123xyz"
  },
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "data": null,
  "meta": {
    "requestId": "req_abc123xyz"
  },
  "error": {
    "code": "notFound",
    "message": "Country not found",
    "details": [
      {
        "reason": "countryNotFound",
        "message": "Country does not exist or has been deleted"
      }
    ]
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalidCredentials` | 401 | Wrong email or password |
| `unauthorized` | 401 | Missing or invalid token |
| `accountInactive` | 403 | User account is deactivated |
| `permissionDenied` | 403 | Missing required permissions |
| `forbidden` | 403 | Access denied |
| `notFound` | 404 | Resource not found |
| `countryNotFound` | 404 | Country not found |
| `visaTypeNotFound` | 404 | Visa type not found |
| `templateNotFound` | 404 | Template not found |
| `bindingNotFound` | 404 | Template binding not found (also used for public selection) |
| `applicationNotFound` | 404 | Application not found |
| `applicantNotFound` | 404 | Applicant not found |
| `documentNotFound` | 404 | Document not found |
| `applicationNotEditable` | 409 | Application cannot be edited (not in DRAFT status) |
| `invalidStatusTransition` | 400 | Invalid status transition |
| `otpInvalid` | 400 | Invalid OTP code |
| `otpExpired` | 400 | OTP code has expired |
| `fileTooLarge` | 413 | File exceeds maximum size (10MB) |
| `fileTypeNotAllowed` | 415 | File type not in allowlist |
| `fileUploadFailed` | 500 | Failed to save file |
| `paymentNotFound` | 404 | Payment not found |
| `paymentInitializationFailed` | 500 | Failed to initialize payment with provider |
| `paymentCallbackInvalid` | 400 | Invalid callback payload |
| `paymentAmountMismatch` | 400 | Amount mismatch detected |
| `paymentExpired` | 410 | Payment has expired |
| `conflict` | 409 | Duplicate resource (key, fieldKey, binding, nationality fee, active payment, etc.) |
| `validationError` | 400 | Request validation failed |

## Form Builder Details

### Supported Field Types

| Type | Description | Options/Validation |
|------|-------------|-------------------|
| `text` | Single-line text input | minLength, maxLength, pattern |
| `textarea` | Multi-line text input | minLength, maxLength |
| `select` | Dropdown selection | optionsJson required |
| `radio` | Radio button group | optionsJson required |
| `checkbox` | Checkbox (single or group) | optionsJson for groups |
| `date` | Date picker | minDate, maxDate |
| `file` | File upload | allowedFileTypes, maxFileSizeMb |
| `email` | Email input | Built-in email validation |
| `phone` | Phone number input | pattern for format |
| `number` | Numeric input | min, max |

### Field Key Uniqueness

**Important**: `fieldKey` must be unique within the entire template (across all sections), not just within a section. This design choice ensures:
- Form data can be stored as flat key-value pairs
- No field key collisions when processing form submissions
- Simpler form data validation and mapping

### Template Versioning

Templates have a `version` field that is:
- Initialized to `1` on creation
- **Not auto-incremented** on updates in this stage
- Can be manually updated if needed

Advanced version history management (snapshots, rollback) is planned for future phases.

### Visibility Rules

Fields can be conditionally shown/hidden based on other field values:

```json
{
  "visibilityRulesJson": [
    {
      "sourceFieldKey": "isExpedited",
      "operator": "equals",
      "value": "true"
    }
  ]
}
```

Supported operators: `equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`

## Template Bindings Details

### Business Purpose

A template binding links:
- **Destination Country**: Where the visa is for
- **Visa Type**: Type of visa (tourism, business, etc.)
- **Template**: The form template to use for applications

Nationality fees define pricing per applicant nationality within a binding.

### Duplicate Binding Rule

**Only one active binding is allowed per destination country + visa type combination.**

This ensures:
- Clear mapping from destination + visa type to a single template
- No ambiguity when selecting which form to show
- Simplified public selection logic

### Date Validity

Bindings support optional date ranges:

| Field | Behavior |
|-------|----------|
| `validFrom` | If set, binding only valid on/after this date |
| `validTo` | If set, binding only valid on/before this date |
| Both null | Binding is always valid |

### Public Selection Matching Logic

When a user requests a fee preview:

1. Find binding matching `destinationCountryId` + `visaTypeId`
2. Binding must be: `isActive=true`, not soft-deleted, valid by date range
3. Find nationality fee matching `nationalityCountryId`
4. Fee must be: `isActive=true`, not soft-deleted
5. Return `bindingId`, `templateId`, and fee breakdown

If no valid combination exists, returns `bindingNotFound` error.

### Nationality Options Source

**Assumption**: Nationality countries currently use the same `countries` table as destination countries. All active countries are available as nationality options.

In production, you may want to:
- Create a separate nationality source
- Filter to countries that have at least one fee configured
- Use a different data source entirely

## Singleton Configurations

### Settings
- Auto-creates default settings on first read if none exist
- Single active record in database
- Update modifies existing record (no duplicates)

### Payment Page Config
- Auto-creates default config on first read if none exist
- Single active record in database
- JSON-based sections configuration

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `API_PREFIX` | API route prefix | `api/v1` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_ACCESS_EXPIRATION_SECONDS` | Admin access token TTL | `3600` |
| `JWT_REFRESH_EXPIRATION_SECONDS` | Admin refresh token TTL | `604800` |
| `JWT_PORTAL_ACCESS_SECRET` | Portal JWT access token secret | - |
| `JWT_PORTAL_REFRESH_SECRET` | Portal JWT refresh token secret | - |
| `JWT_PORTAL_ACCESS_EXPIRATION_SECONDS` | Portal access token TTL | `3600` |
| `JWT_PORTAL_REFRESH_EXPIRATION_SECONDS` | Portal refresh token TTL | `604800` |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | `12` |
| `UPLOAD_PATH` | Local file upload directory | `./uploads` |
| `OTP_EXPIRY_MINUTES` | OTP code expiry time | `10` |
| `OTP_RESEND_COOLDOWN_SECONDS` | Minimum wait between OTP requests | `60` |
| `OTP_MAX_ATTEMPTS_PER_HOUR` | Max OTP requests per hour per email | `10` |
| `EMAIL_PROVIDER` | Email provider: `smtp`, `console`, `auto` | `auto` |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use TLS for SMTP | `false` |
| `SMTP_USER` | SMTP authentication username | - |
| `SMTP_PASS` | SMTP authentication password | - |
| `SMTP_FROM_EMAIL` | Default sender email address | - |
| `SMTP_FROM_NAME` | Default sender display name | `E-Visa Portal` |

See `.env.example` for all available variables.

### Email Provider Configuration

The email system supports multiple providers:

- **`auto`** (default): Uses SMTP if configured, otherwise console
- **`smtp`**: Force real SMTP sending (requires SMTP_* config)
- **`console`**: Log emails to console (development/testing)

Example for Gmail SMTP:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=E-Visa Portal
```

For development without SMTP:
```env
EMAIL_PROVIDER=console
```

## Portal Authentication

### OTP-Based Authentication

Portal users authenticate using OTP (One-Time Password) sent to their email:

1. User enters email → `POST /portal/auth/sendOtp`
2. OTP is sent via email (using configured EMAIL_PROVIDER)
   - In development mode, OTP is also returned in response for testing
3. User verifies OTP → `POST /portal/auth/verifyOtp`
4. User receives access + refresh tokens

**Note**: If email sending fails, OTP is still created and can be used. The response indicates whether email delivery succeeded.
5. Use access token for portal endpoints

### Development Mode OTP Behavior

**Important**: In development mode (`NODE_ENV !== 'production'`), the OTP code is returned in the `sendOtp` response for testing purposes:

```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "devOtpCode": "123456",
    "expiresAt": "2026-04-11T12:00:00.000Z"
  }
}
```

In production, the OTP would be sent via email (SMTP not implemented yet).

### OTP Behavior
- OTP is 6 digits
- OTP expires after 10 minutes
- OTP is single-use (marked as used after verification)
- Previous unused OTPs are invalidated when new OTP is requested
- OTP is stored hashed in database

### Portal Identity Auto-Creation

When a user verifies OTP for the first time, a `PortalIdentity` record is automatically created. This means:
- No registration step required
- First OTP verification creates the account
- Subsequent logins use the same identity

## Application Flow

### Application Status Flow

```
DRAFT → UNPAID → SUBMITTED → IN_REVIEW → APPROVED/REJECTED
```

### Current Stage Behavior

**Temporary Submit Behavior**: Since payment is not implemented yet, applications can be submitted from both `DRAFT` and `UNPAID` status. In production, submission should require `PaymentStatus.PAID`.

### Editable States

Applications and applicants can only be edited when the application is in `DRAFT` status. Once submitted for review, editing is blocked.

### Main Applicant Rule

- Only one applicant per application can be marked as `isMainApplicant: true`
- Attempting to set a second main applicant returns a conflict error
- First applicant can be set as main applicant

### Application Code Generation

**Generation Rule**: `applicationCode` is automatically generated when an applicant is created.

Format: `APP-YYYY-NNNNNN` (e.g., `APP-2026-000001`)

- Year is the current year
- Number is a 6-digit sequential counter per year
- Code is unique across all applicants
- Used for public tracking

### Resume Token

Each application has a unique `resumeToken` generated on creation. This allows users to resume incomplete applications using `GET /portal/applications/resume/:resumeToken`.

## Document Upload

### Local Storage

Documents are stored on the local filesystem in development:

- **Upload path**: `./uploads` (configurable via `UPLOAD_PATH` env var)
- **File structure**: `./uploads/documents/{applicantId}/{uniqueId}.{ext}`
- **Safe filename**: Random hex string to prevent path traversal

### File Validation

| Constraint | Value |
|------------|-------|
| Max file size | 10MB |
| Allowed types | `application/pdf`, `image/jpeg`, `image/png` |

### Upload Flow

1. Portal user uploads file via `POST /portal/documents/upload` (multipart)
2. File is validated (size, type)
3. Ownership is verified (applicant belongs to user's application)
4. Application must be in DRAFT status
5. File is saved to disk with safe filename
6. Metadata is stored in database

### Document Review

Admin can review documents via `PATCH /admin/documents/:documentId/review`:

- `PENDING` → Initial state
- `APPROVED` → Document accepted
- `REJECTED` → Document rejected (with note)
- `NEEDS_REUPLOAD` → User needs to upload again

### Soft Delete Behavior

When a document is deleted:
- Database record is soft-deleted (`deletedAt` set)
- File remains on disk for audit purposes
- Manual cleanup may be needed for disk space

## Public Tracking

### Tracking Endpoint

`POST /api/v1/public/tracking/search`

```json
{
  "email": "user@example.com",
  "applicationCode": "APP-2026-000001"
}
```

### Matching Logic

- Email must match the applicant's email (case-insensitive)
- Application code must match exactly
- Returns applicant's status and status history
- No authentication required

### Response

```json
{
  "success": true,
  "data": {
    "applicationCode": "APP-2026-000001",
    "currentStatus": "IN_REVIEW",
    "statusHistory": [
      {
        "oldStatus": "DRAFT",
        "newStatus": "SUBMITTED",
        "note": null,
        "changedAt": "2026-04-01T09:00:00Z"
      }
    ],
    "resultAvailable": false,
    "resultFileName": null
  }
}
```

## Status Workflow

### Status Transition Maps

**Application Status:**
```
DRAFT → UNPAID, CANCELLED
UNPAID → SUBMITTED, CANCELLED
SUBMITTED → IN_REVIEW, CANCELLED
IN_REVIEW → NEED_DOCS, APPROVED, REJECTED
NEED_DOCS → IN_REVIEW, CANCELLED
APPROVED → READY_TO_DOWNLOAD
REJECTED → (terminal)
READY_TO_DOWNLOAD → (terminal)
CANCELLED → (terminal)
```

**Applicant Status:**
```
DRAFT → SUBMITTED
SUBMITTED → IN_REVIEW
IN_REVIEW → NEED_DOCS, APPROVED, REJECTED
NEED_DOCS → IN_REVIEW
APPROVED → READY_TO_DOWNLOAD
REJECTED → (terminal)
READY_TO_DOWNLOAD → (terminal)
```

### Querying Transitions

Admin can query allowed transitions via:

`GET /api/v1/admin/statusWorkflow/transitions?entityType=applicant&currentStatus=SUBMITTED`

Response:
```json
{
  "entityType": "applicant",
  "currentStatus": "SUBMITTED",
  "allowedTransitions": ["IN_REVIEW"]
}
```

## Payments

### Payment Provider Abstraction

The payment system uses a provider abstraction pattern:

```
PaymentProvider (interface)
├── MockPaymentProvider (development)
├── StripeProvider (future)
└── PayPalProvider (future)
```

### Mock Provider Behavior

In development, the `mockProvider` is used:

- Returns fake session IDs and redirect URLs
- Simulates successful payment initialization
- Accepts callbacks with `paymentReference` field
- Maps `status` field to internal payment status
- No signature validation (marked as `NOT_APPLICABLE`)

Example mock redirect URL:
```
http://localhost:3000/mock-payment/checkout?session=mock_sess_abc123&ref=PAY-2026-000001
```

### Payment Flow

1. **Create Payment**: Portal user creates payment for their application
   - Fee amounts are snapshotted from binding/nationality fees
   - Payment reference is generated (PAY-YYYY-NNNNNN)
   - Idempotency key is generated
   - Expiration time is set (default: 3 hours)

2. **Initialize Payment**: User initializes payment with provider
   - Provider returns session ID and redirect URL
   - Payment status changes to PENDING
   - Transaction record is created

3. **User Pays**: User is redirected to payment page (mock or real)

4. **Callback**: Provider sends webhook to callback endpoint
   - Raw payload and headers are stored
   - Payment is matched by reference or provider ID
   - Status is updated based on callback content
   - Transaction record is created

5. **Completion**: Payment status becomes PAID
   - Application payment status is updated
   - Application moves from UNPAID to SUBMITTED

### Duplicate Payment Prevention

**Rule**: Only one active payment per application is allowed.

Active payment statuses:
- `CREATED` - Payment created, not yet initialized
- `PENDING` - Payment initialized, awaiting completion
- `PROCESSING` - Payment being processed by provider

If an active payment exists:
- If expired, it's auto-expired and new payment can be created
- Otherwise, returns conflict error

Completed (`PAID`) payments also block new payment creation.

### Payment Status Model

| Status | Description |
|--------|-------------|
| `CREATED` | Payment created, not initialized |
| `PENDING` | Initialized, awaiting payment |
| `PROCESSING` | Being processed by provider |
| `PAID` | Successfully completed |
| `FAILED` | Payment failed |
| `EXPIRED` | Payment expired |
| `CANCELLED` | Manually cancelled |
| `REFUNDED` | Fully refunded |
| `PARTIALLY_REFUNDED` | Partially refunded |

### Status Transitions

```
CREATED → PENDING, EXPIRED, CANCELLED
PENDING → PROCESSING, PAID, FAILED, EXPIRED, CANCELLED
PROCESSING → PAID, FAILED
PAID → REFUNDED, PARTIALLY_REFUNDED
FAILED → PENDING (retry)
EXPIRED → (terminal)
CANCELLED → (terminal)
REFUNDED → (terminal)
PARTIALLY_REFUNDED → REFUNDED
```

### Application Status Update After Payment

When payment becomes `PAID`:
1. Application `paymentStatus` is set to `PAID`
2. If application is in `UNPAID` status, it moves to `SUBMITTED`
3. Application status history is recorded

### Payment Reference Format

Format: `PAY-YYYY-NNNNNN` (e.g., `PAY-2026-000001`)

- Year is the current year
- Number is a 6-digit sequential counter per year
- Reference is unique across all payments

### Admin Manual Status Update

Admin can manually update payment status via:

`PATCH /api/v1/admin/payments/:paymentId/status`

```json
{
  "status": "PAID",
  "note": "Marked as paid by admin for testing"
}
```

This creates:
- Payment status history entry
- Transaction record for audit

### Callback Storage

All callbacks are stored with:
- Raw headers
- Raw payload (JSON)
- Provider key
- Callback type/event
- Signature validation status
- Processing status
- Error message (if any)

### Reconciliation

The reconciliation structure is ready for future provider settlement checks:

- `PENDING` - Not yet reconciled
- `MATCHED` - Amount and currency match
- `MISMATCHED` - Discrepancy detected
- `MANUAL_REVIEW` - Requires manual review

---

## Notifications

### Overview

The notifications module manages notification records for email, SMS, and push notifications. In the current implementation, actual sending is mocked - notifications are created and marked as SENT after a brief delay.

### Notification Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Created, awaiting sending |
| `SENT` | Successfully sent (mocked) |
| `FAILED` | Sending failed |
| `DELIVERED` | Delivery confirmed |

### Retry Behavior

**Retryable statuses**: `PENDING`, `FAILED`

When retrying a notification:
1. Retry count is incremented
2. Status is reset to `PENDING`
3. Error message is cleared
4. Mock sending is triggered (marks as SENT after ~1 second)

**Maximum retries**: 3 (configurable per notification)

### Mock Sending Behavior

In development mode:
- Notifications are created with `PENDING` status
- After ~1 second, status is automatically updated to `SENT`
- No actual email/SMS/push is sent
- Useful for testing notification flows without external services

### What's Missing for Production

- [ ] SMTP integration for email sending
- [ ] SMS provider integration (Twilio, etc.)
- [ ] Push notification service (Firebase, etc.)
- [ ] Notification templates with variable substitution
- [ ] Delivery status webhooks

---

## Jobs

### Overview

The jobs module provides DB-based background job management. Jobs are stored in the database and prepared for future worker/processor execution.

### Job Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Queued, awaiting execution |
| `RUNNING` | Currently being processed |
| `COMPLETED` | Successfully completed |
| `FAILED` | Execution failed |
| `CANCELLED` | Manually cancelled |

### Retry Behavior

**Retryable statuses**: `FAILED`, `CANCELLED`

When retrying a job:
1. Retry count is incremented
2. Status is reset to `PENDING`
3. Error message is cleared
4. Execution timestamps are reset
5. A new job execution record is created

**Maximum retries**: 3 (configurable per job)

### Cancel Behavior

**Cancellable statuses**: `PENDING`, `RUNNING`

When cancelling a job:
1. Status is set to `CANCELLED`
2. Finished timestamp is set
3. A job execution record is created with `CANCELLED` status

### Job Execution History

Each job tracks its execution attempts:
- Execution status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- Start and finish timestamps
- Error messages per execution

### What's Missing for Production

- [ ] Background worker/processor to execute jobs
- [ ] Job scheduling (cron-like)
- [ ] Job priorities
- [ ] Job dependencies
- [ ] External queue integration (Redis, etc.)

---

## Audit Logs

### Overview

The audit logs module provides visibility into admin actions performed in the system. Logs capture who did what, when, and the before/after state of entities.

### Logged Actions

Currently, audit logs are written for:

| Entity | Actions |
|--------|---------|
| User | CREATE, UPDATE, DELETE, STATUS_CHANGE |
| Payment | MANUAL_STATUS_UPDATE |

### Audit Log Structure

Each audit log contains:
- `actorUserId` - User who performed the action (null for system)
- `actorType` - USER, SYSTEM, or PORTAL_IDENTITY
- `actionKey` - Action identifier (e.g., USER_CREATED)
- `entityType` - Type of entity affected (e.g., User)
- `entityId` - ID of affected entity
- `oldValueJson` - Previous state (for updates)
- `newValueJson` - New state (for creates/updates)
- `ipAddress` - Request IP (when available)
- `userAgent` - Request user agent (when available)

### Filters

Audit logs can be filtered by:
- `actorUserId` - Filter by specific user
- `entityType` - Filter by entity type
- `actionKey` - Filter by action
- `dateFrom` / `dateTo` - Date range

### What's Missing for Production

- [ ] More entity types (roles, countries, visa types, etc.)
- [ ] IP address and user agent capture
- [ ] Audit log retention policies
- [ ] Export functionality

---

## Dashboard

### Overview

The dashboard module provides summary statistics and chart data for the admin interface.

### Summary Statistics

| Metric | Description |
|--------|-------------|
| `totalApplications` | Total application count |
| `draftApplications` | Applications in DRAFT status |
| `unpaidApplications` | Applications awaiting payment |
| `submittedApplications` | Submitted applications |
| `inReviewApplications` | Applications under review |
| `approvedApplications` | Approved applications |
| `rejectedApplications` | Rejected applications |
| `totalPayments` | Total payment count |
| `paidPayments` | Successful payments |
| `failedPayments` | Failed payments |
| `pendingPayments` | Pending payments |
| `totalPortalUsers` | Portal user count |
| `totalAdminUsers` | Admin user count |
| `totalRevenue` | Total revenue from paid payments |
| `revenueToday` | Today's revenue |

### Charts Data

| Chart | Description |
|-------|-------------|
| `applicationsByStatus` | Application counts grouped by status |
| `paymentsByStatus` | Payment counts grouped by status |
| `applicationsByDestination` | Top 10 destination countries |
| `revenueByMonth` | Monthly revenue (last 6 months) |
| `recentDailyApplications` | Daily application counts (last 30 days) |

## Available Scripts

```bash
# Development
npm run start:dev      # Start with hot-reload
npm run start:debug    # Start with debugging

# Build
npm run build          # Build for production
npm run start:prod     # Start production build

# Database
npm run prisma:generate  # Generate Prisma client
npm run db:push          # Push schema to database
npm run prisma:migrate:dev  # Create migration
npm run prisma:seed      # Seed default data

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format with Prettier

# Testing
npm run test           # Run unit tests
npm run test:cov       # Run tests with coverage
```

## License

Private - All rights reserved
