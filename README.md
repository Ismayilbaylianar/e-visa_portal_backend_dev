# E-Visa Portal Backend

Production-ready backend API for an online visa application portal built with NestJS, Prisma, and PostgreSQL.

## Current Stage: Configuration Modules Implementation

This repository contains the complete backend architecture with fully functional IAM and Configuration layers.

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

### What's NOT Implemented Yet

- [ ] Templates (form templates)
- [ ] Template sections/fields
- [ ] Template bindings
- [ ] Nationality fees
- [ ] Portal OTP authentication
- [ ] Applications workflow
- [ ] Documents/file upload
- [ ] Payment integrations
- [ ] Notifications
- [ ] Background jobs
- [ ] Audit logs

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
| `applications` | read, update, review |
| `payments` | read, refund |
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
| `conflict` | 409 | Duplicate resource |
| `validationError` | 400 | Request validation failed |

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

## License

Private - All rights reserved
