# E-Visa Portal Backend

Production-ready backend API for an online visa application portal built with NestJS, Prisma, and PostgreSQL.

## Current Stage: Foundation + Full Module Structure

This repository contains the complete backend architecture and API foundation for a visa portal system.

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

#### Database Schema (30+ models)
- [x] Access Control: User, Role, Permission, RolePermission, UserPermission, Session
- [x] Portal Auth: PortalIdentity, PortalSession, OtpCode
- [x] Configuration: Country, CountrySection, VisaType, Template, TemplateSection, TemplateField, TemplateBinding, BindingNationalityFee, PaymentPageConfig, EmailTemplate, Setting
- [x] Application Domain: Application, ApplicationApplicant, ApplicationStatusHistory, ApplicantStatusHistory, Document
- [x] Payments: Payment, PaymentTransaction, PaymentStatusHistory, PaymentCallback, PaymentReconciliation
- [x] Support: Notification, Job, JobExecution, AuditLog

#### API Modules (35+ modules)

**System**
- [x] Health (`/system/health/live`, `/system/health/ready`)

**Admin Auth & Access Control**
- [x] Auth (`/admin/auth/login`, `/admin/auth/refresh`, `/admin/auth/logout`)
- [x] Sessions (`/admin/sessions/me`, `/admin/sessions/:id`, `/admin/sessions/revokeAll`)
- [x] Users (CRUD + status management)
- [x] Roles (CRUD)
- [x] Permissions (list, matrix, role/user permission management)
- [x] Access Control (internal service)

**Portal Auth**
- [x] Portal Auth (`/portal/auth/sendOtp`, `/portal/auth/verifyOtp`, `/portal/auth/refresh`, `/portal/auth/logout`)
- [x] Portal Sessions (internal service)
- [x] OTP (internal service)

**Configuration**
- [x] Countries (admin CRUD + public endpoints)
- [x] Country Sections (admin CRUD)
- [x] Visa Types (admin CRUD + public endpoint)
- [x] Templates (admin CRUD)
- [x] Template Sections (admin CRUD)
- [x] Template Fields (admin CRUD)
- [x] Template Bindings (admin CRUD)
- [x] Binding Nationality Fees (admin CRUD)
- [x] Payment Page Configs (admin get/update)
- [x] Email Templates (admin CRUD)
- [x] Settings (admin get/update)

**Public**
- [x] Public Selection (`/public/selection/options`, `/public/selection/preview`)
- [x] Tracking (`/public/tracking/search`)

**Application Domain**
- [x] Applications (admin list/view, portal CRUD + submit)
- [x] Applicants (portal CRUD, admin status update)
- [x] Form Renderer (`/portal/forms/schema`)
- [x] Documents (portal upload/view/delete, admin review)
- [x] Customer Portal (`/portal/me/applications`)
- [x] Status Workflow (internal service)

**Payments**
- [x] Payments (admin list/view/status, portal create/initialize, public callbacks)
- [x] Payment Transactions (internal service)

**Support**
- [x] Dashboard (`/admin/dashboard/summary`, `/admin/dashboard/charts`)
- [x] Audit Logs (admin list/view)
- [x] Jobs (admin list/view/retry/cancel)
- [x] Notifications (internal service)
- [x] Geo Lookup (internal service)

### What's NOT Implemented Yet

- [ ] Actual JWT token generation/validation
- [ ] Password hashing (bcrypt)
- [ ] Full RBAC enforcement
- [ ] File upload storage (S3/local)
- [ ] Email sending service
- [ ] Payment provider integrations
- [ ] Background job processing
- [ ] Rate limiting
- [ ] Caching

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 16
- **Documentation**: Swagger/OpenAPI 7.x
- **Validation**: class-validator, class-transformer
- **Container**: Docker, Docker Compose

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── common/                    # Shared utilities
│   ├── constants/             # Error codes, API constants
│   ├── decorators/            # Custom decorators
│   ├── dto/                   # Common DTOs
│   ├── enums/                 # Application enums
│   ├── exceptions/            # Custom exceptions
│   ├── filters/               # Exception filters
│   ├── guards/                # Auth guards
│   ├── interceptors/          # Request/response interceptors
│   ├── types/                 # TypeScript types
│   └── utils/                 # Utility functions
├── config/                    # Configuration files
│   ├── app.config.ts
│   ├── db.config.ts
│   └── swagger.config.ts
└── modules/                   # Feature modules
    ├── prisma/                # Database service
    ├── health/                # Health checks
    ├── auth/                  # Admin authentication
    ├── sessions/              # Admin sessions
    ├── users/                 # User management
    ├── roles/                 # Role management
    ├── permissions/           # Permission management
    ├── accessControl/         # Access control service
    ├── portalAuth/            # Portal authentication
    ├── portalSessions/        # Portal sessions
    ├── otp/                   # OTP service
    ├── countries/             # Country management
    ├── countrySections/       # Country sections
    ├── visaTypes/             # Visa types
    ├── templates/             # Form templates
    ├── templateSections/      # Template sections
    ├── templateFields/        # Template fields
    ├── templateBindings/      # Template bindings
    ├── bindingNationalityFees/# Fee configuration
    ├── paymentPageConfigs/    # Payment page config
    ├── emailTemplates/        # Email templates
    ├── settings/              # System settings
    ├── publicSelection/       # Public selection
    ├── tracking/              # Application tracking
    ├── applications/          # Applications
    ├── applicants/            # Applicants
    ├── formRenderer/          # Form schema
    ├── documents/             # Documents
    ├── customerPortal/        # Customer portal
    ├── statusWorkflow/        # Status workflow
    ├── payments/              # Payments
    ├── paymentTransactions/   # Payment transactions
    ├── notifications/         # Notifications
    ├── jobs/                  # Background jobs
    ├── auditLogs/             # Audit logs
    ├── dashboard/             # Dashboard
    └── geoLookup/             # Geo lookup
```

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

# Push schema to database (development)
npm run db:push
```

### Running Locally

```bash
# Start PostgreSQL (if not using Docker)
# Make sure PostgreSQL is running on localhost:5432

# Development mode with hot-reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Running with Docker

```bash
# Start all services (PostgreSQL + API)
docker compose -f docker-compose.dev.yml up --build

# Run in background
docker compose -f docker-compose.dev.yml up -d --build

# Stop services
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f api
```

## API Documentation

Once the application is running, access Swagger documentation at:

```
http://localhost:3000/docs
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123xyz",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "error": null
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "requestId": "req_abc123xyz",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
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
    "requestId": "req_abc123xyz",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "error": {
    "code": "validationError",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "reason": "invalidFormat",
        "message": "Email format is invalid"
      }
    ]
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `API_PREFIX` | API route prefix | `api/v1` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `SWAGGER_TITLE` | Swagger doc title | `Visa Portal Backend API` |
| `SWAGGER_DESCRIPTION` | Swagger doc description | - |
| `SWAGGER_VERSION` | API version | `1.0.0` |

See `.env.example` for all available variables.

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
npm run db:migrate       # Run migrations (production)

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint errors
npm run format         # Format with Prettier

# Testing
npm run test           # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Run tests with coverage
npm run test:e2e       # Run e2e tests
```

## Docker Commands

```bash
# Build image
docker build -t evisa-backend .

# Run container
docker run -p 3000:3000 --env-file .env evisa-backend

# Development with compose
docker compose -f docker-compose.dev.yml up --build

# Production with compose
docker compose up --build
```

## Route Groups

| Prefix | Description | Authentication |
|--------|-------------|----------------|
| `/api/v1/public/*` | Public endpoints | None |
| `/api/v1/portal/*` | Customer portal | Portal JWT |
| `/api/v1/admin/*` | Admin endpoints | Admin JWT |
| `/api/v1/system/*` | System endpoints | None/Admin |

## License

Private - All rights reserved
