# E-Visa Portal Backend

Production-ready backend API for an online visa application portal built with NestJS, Prisma, and PostgreSQL.

## Current Stage: IAM Layer Implementation

This repository contains the complete backend architecture with a fully functional Identity and Access Management (IAM) layer.

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
- [x] **Authentication**
  - JWT-based admin authentication
  - Login with email/password
  - Access token (1 hour) and refresh token (7 days)
  - Token refresh endpoint
  - Logout with session revocation
  - Password hashing with bcrypt
  - Refresh token hashing before storage
- [x] **Session Management**
  - Database-persisted sessions
  - View active sessions
  - Revoke individual sessions
  - Revoke all sessions (except current)
  - Session tracking (IP, user agent, last activity)
- [x] **User Management**
  - Full CRUD operations
  - Password hashing on create
  - Email uniqueness validation
  - Soft delete
  - Status management (activate/deactivate)
  - Deactivation revokes all sessions
- [x] **Role Management**
  - Full CRUD operations
  - System role protection
  - User count tracking
  - Prevent deletion of roles with active users
  - Soft delete
- [x] **Permission Management**
  - Permission listing
  - Permission matrix view (grouped by module)
  - Role permission assignment (replace all)
  - User permission overrides (grants/denies)
- [x] **Access Control**
  - JWT authentication guard
  - Permission-based authorization guard
  - `@Public()` decorator for public routes
  - `@RequirePermissions()` decorator
  - `@CurrentUser()` decorator
  - Role permissions + user overrides calculation

#### Database Schema (30+ models)
- [x] Access Control: User, Role, Permission, RolePermission, UserPermission, Session
- [x] Portal Auth: PortalIdentity, PortalSession, OtpCode
- [x] Configuration: Country, CountrySection, VisaType, Template, TemplateSection, TemplateField, TemplateBinding, BindingNationalityFee, PaymentPageConfig, EmailTemplate, Setting
- [x] Application Domain: Application, ApplicationApplicant, ApplicationStatusHistory, ApplicantStatusHistory, Document
- [x] Payments: Payment, PaymentTransaction, PaymentStatusHistory, PaymentCallback, PaymentReconciliation
- [x] Support: Notification, Job, JobExecution, AuditLog

#### API Modules (35+ modules scaffolded, IAM modules fully functional)

**System**
- [x] Health (`/system/health/live`, `/system/health/ready`)

**Admin Auth & Access Control (FULLY FUNCTIONAL)**
- [x] Auth (`POST /admin/auth/login`, `POST /admin/auth/refresh`, `POST /admin/auth/logout`)
- [x] Sessions (`GET /admin/sessions/me`, `DELETE /admin/sessions/:id`, `DELETE /admin/sessions/revokeAll`)
- [x] Users (`GET/POST/PATCH/DELETE /admin/users`, `PATCH /admin/users/:id/status`)
- [x] Roles (`GET/POST/PATCH/DELETE /admin/roles`)
- [x] Permissions (`GET /admin/permissions`, `GET /admin/permissions/matrix`, `PATCH /admin/permissions/roles/:id/permissions`, `PATCH /admin/permissions/users/:id/permissions`)

**Other Modules (Scaffolded)**
- Portal Auth, Countries, Visa Types, Templates, Applications, Payments, etc.

### What's NOT Implemented Yet

- [ ] Portal OTP authentication
- [ ] Countries/Visa Types/Templates CRUD logic
- [ ] Application workflow
- [ ] File upload storage
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

### Running with Docker

```bash
# Start all services (PostgreSQL + API)
docker compose -f docker-compose.dev.yml up --build

# Run in background
docker compose -f docker-compose.dev.yml up -d --build

# Stop services
docker compose -f docker-compose.dev.yml down
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

The seed script creates the following permission groups:

| Module | Actions |
|--------|---------|
| `users` | read, create, update, delete |
| `roles` | read, create, update, delete |
| `permissions` | read, update |
| `sessions` | read, delete |
| `countries` | read, create, update, delete |
| `visaTypes` | read, create, update, delete |
| `templates` | read, create, update, delete |
| `applications` | read, update, review |
| `payments` | read, refund |
| `settings` | read, update |
| `auditLogs` | read |
| `dashboard` | read |

**Role Permission Mapping:**
- **superAdmin**: All permissions
- **admin**: Most permissions (no user delete, no role management)
- **operator**: Read-only + application review

## API Documentation

Once the application is running, access Swagger documentation at:

```
http://localhost:3000/docs
```

## API Endpoints (IAM Layer)

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

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresInSeconds": 3600,
    "user": {
      "id": "uuid",
      "fullName": "Super Admin",
      "email": "super@visa.com",
      "roleId": "uuid",
      "roleKey": "superAdmin",
      "isActive": true
    }
  },
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
    "code": "invalidCredentials",
    "message": "Invalid credentials",
    "details": [
      {
        "reason": "invalidCredentials",
        "message": "Email or password is incorrect"
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
| `conflict` | 409 | Duplicate resource (e.g., email) |
| `validationError` | 400 | Request validation failed |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `API_PREFIX` | API route prefix | `api/v1` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `JWT_ACCESS_EXPIRATION_SECONDS` | Access token TTL | `3600` |
| `JWT_REFRESH_EXPIRATION_SECONDS` | Refresh token TTL | `604800` |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | `12` |

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
npm run prisma:migrate:dev  # Create migration
npm run prisma:seed      # Seed default data

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format with Prettier

# Testing
npm run test           # Run unit tests
npm run test:cov       # Run tests with coverage
```

## Security Features

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ Refresh tokens hashed before database storage
- ✅ JWT tokens with configurable expiration
- ✅ Session-based token revocation
- ✅ Soft delete for users (preserves audit trail)
- ✅ Inactive users cannot login
- ✅ Deleted users cannot login
- ✅ Permission-based access control
- ✅ User-level permission overrides

## License

Private - All rights reserved
