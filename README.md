# E-Visa Portal Backend

Production-ready NestJS backend foundation for the E-Visa Portal system.

## Current Stage: Foundation Setup

This repository contains the initial backend foundation. The focus is on project bootstrap, architecture skeleton, core conventions, and infrastructure setup.

### What's Implemented

- [x] **Project Structure** - Scalable NestJS architecture
- [x] **Global API Prefix** - `/api/v1`
- [x] **Swagger Documentation** - Available at `/docs`
- [x] **Health Module** - Liveness and readiness endpoints
- [x] **Unified Response Format** - Consistent success/error responses
- [x] **Global Exception Filter** - Unified error handling
- [x] **Global Validation** - Request validation with class-validator
- [x] **Prisma ORM** - PostgreSQL integration with initial schema
- [x] **Docker Setup** - Development environment with docker-compose
- [x] **Environment Configuration** - Secure config management
- [x] **Module Skeletons** - Auth, Users, Roles, Permissions (empty)

### What's NOT Implemented Yet

- [ ] Full authentication flow (JWT)
- [ ] User CRUD operations
- [ ] Role-based access control (RBAC)
- [ ] Application/Applicant modules
- [ ] Template management
- [ ] Payment integration
- [ ] Email service
- [ ] File uploads
- [ ] Audit logging
- [ ] Background jobs

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10.x | Framework |
| TypeScript | 5.x | Language |
| Prisma | 5.x | ORM |
| PostgreSQL | 16 | Database |
| Swagger | 7.x | API Documentation |
| Docker | - | Containerization |

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── common/                 # Shared utilities
│   ├── constants/          # Error codes, etc.
│   ├── decorators/         # Custom decorators
│   ├── dto/                # Common DTOs
│   ├── exceptions/         # Custom exceptions
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Response interceptors
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── config/                 # Configuration files
│   ├── app.config.ts
│   ├── db.config.ts
│   └── swagger.config.ts
└── modules/                # Feature modules
    ├── auth/               # Authentication (skeleton)
    ├── health/             # Health checks
    ├── permissions/        # Permissions (skeleton)
    ├── prisma/             # Database service
    ├── roles/              # Roles (skeleton)
    └── users/              # Users (skeleton)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL 16+ (or Docker)

### Installation

```bash
# Clone the repository
git clone git@github.com:Ismayilbaylianar/e-visa_portal_backend_dev.git
cd e-visa_portal_backend_dev

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Running Locally

#### Option 1: With Local PostgreSQL

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run db:push

# Start development server
npm run start:dev
```

#### Option 2: With Docker

```bash
# Start all services (PostgreSQL + API)
docker compose -f docker-compose.dev.yml up --build

# Or run in background
docker compose -f docker-compose.dev.yml up -d --build
```

### Accessing the Application

| Service | URL |
|---------|-----|
| API | http://localhost:3000/api/v1 |
| Swagger Docs | http://localhost:3000/docs |
| Health (Live) | http://localhost:3000/api/v1/system/health/live |
| Health (Ready) | http://localhost:3000/api/v1/system/health/ready |

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Example"
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
    "code": "validationError",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "reason": "invalidFormat",
        "message": "Email is invalid"
      }
    ]
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `API_PREFIX` | API prefix | `api/v1` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `SWAGGER_TITLE` | Swagger doc title | `Visa Portal Backend API` |

## Available Scripts

```bash
# Development
npm run start:dev      # Start with hot-reload
npm run start:debug    # Start with debugger

# Build
npm run build          # Build for production
npm run start:prod     # Start production build

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate:dev  # Run migrations (dev)
npm run prisma:studio    # Open Prisma Studio
npm run db:push          # Push schema to DB

# Code Quality
npm run lint           # Run ESLint
npm run format         # Run Prettier
npm run test           # Run tests
```

## Docker Commands

```bash
# Start development environment
docker compose -f docker-compose.dev.yml up --build

# Stop services
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f api

# Access PostgreSQL
docker exec -it evisa-postgres-dev psql -U postgres -d evisa_portal_dev
```

## Error Codes

| Code | Description |
|------|-------------|
| `badRequest` | Invalid request |
| `validationError` | Validation failed |
| `unauthorized` | Authentication required |
| `forbidden` | Access denied |
| `notFound` | Resource not found |
| `conflict` | Resource conflict |
| `internalServerError` | Server error |
| `serviceUnavailable` | Service unavailable |
| `databaseError` | Database error |

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

UNLICENSED - Private repository
