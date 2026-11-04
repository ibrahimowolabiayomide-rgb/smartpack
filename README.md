# SmartPack Asset Intelligence Platform

SmartPack is a company platform for registering, identifying, verifying and tracking the company's
physical SmartPack backpacks, and for recording who holds each bag.

> **Status: Phase 3, backend foundation, authentication and access control.** People sign in
> with real accounts (Argon2id passwords, server-side sessions), and the API enforces roles and
> permissions with strict separation between companies. Company settings, members, invitations,
> roles and the audit log are working, backed by the database. **None of the business modules is
> built yet** (SmartPacks, Workers, Verification, Tracking, Custody, Inspections, Alerts, Reports);
> their pages say they are planned and hold no records or invented data. See
> [docs/PHASE_3_REPORT.md](docs/PHASE_3_REPORT.md).

## Technology

| Area             | Choice                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Monorepo         | pnpm workspaces                                                                             |
| Language         | TypeScript (strict) everywhere                                                              |
| Web              | Next.js (App Router), React, Tailwind CSS, Zod                                              |
| Authentication   | Server-side sessions in PostgreSQL, Argon2id, role-based permissions, audit log             |
| API              | NestJS on Fastify, REST under `/api/v1`, Swagger/OpenAPI                                    |
| Database         | PostgreSQL + PostGIS, Drizzle ORM, version-controlled SQL migrations                        |
| Shared contracts | Zod schemas and inferred types in `packages/shared`                                         |
| Tests            | Vitest (web, shared), Jest + Supertest (API), Playwright (end to end)                       |
| Quality          | ESLint, Prettier, TypeScript strict mode, GitHub Actions                                    |
| Hosting (target) | Vercel for the web app; a separate Node host for the API ([deployment](docs/DEPLOYMENT.md)) |

Exact versions are pinned in each `package.json` and in `pnpm-lock.yaml`.

## Requirements

- **Node.js 22.12 or newer** (the repository pins 22.23.4 in `.node-version`)
- **pnpm 10.28 or newer** (`corepack enable` installs the exact version from `packageManager`)
- **PostgreSQL 16 with PostGIS** via Docker Compose or a native install
  ([docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md))
- **Git**

Do not use npm or yarn; the repository enforces pnpm.

## Installation

```bash
corepack enable
pnpm install

# Environment files (placeholders only; edit the values)
cp apps/api/.env.example        apps/api/.env
cp apps/api/.env.test.example   apps/api/.env.test.local
cp apps/web/.env.example        apps/web/.env.local
```

On Windows PowerShell use `Copy-Item` instead of `cp`.

Start a database and apply migrations. With Docker:

```bash
docker compose up -d db
```

The Compose credentials are `smartpack` / `smartpack_local_dev`, so set these two values:

```
# apps/api/.env
DATABASE_URL=postgresql://smartpack:smartpack_local_dev@localhost:5432/smartpack_dev
# apps/api/.env.test.local
TEST_DATABASE_URL=postgresql://smartpack:smartpack_local_dev@localhost:5432/smartpack_test
```

Without Docker, follow [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md). Then:

```bash
pnpm db:migrate
```

Create the first company and its Owner once (no default account exists; the password is asked at a
hidden prompt):

```bash
pnpm --filter @smartpack/api bootstrap --organization-name "Your Company Ltd" --owner-email you@your-company.example --owner-first-name Ada --owner-last-name Okafor
```

For local development set `WEB_APP_URL=http://localhost:3000` and `EMAIL_PROVIDER=dev-capture` in
`apps/api/.env` (already in the example). See [docs/BOOTSTRAP.md](docs/BOOTSTRAP.md).

## Development

```bash
pnpm dev
```

| Service           | URL                                               |
| ----------------- | ------------------------------------------------- |
| Web application   | http://localhost:3000 (sign in at `/login`)       |
| API               | http://localhost:4000/api/v1                      |
| Health endpoint   | http://localhost:4000/api/v1/health               |
| API documentation | http://localhost:4000/api/docs (development only) |

## Commands

All commands run from the repository root.

| Command                 | What it does                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm install`          | Install dependencies for every workspace package                                             |
| `pnpm dev`              | Run shared (watch), API (watch) and web (dev server) together                                |
| `pnpm build`            | Build shared, API and web for production                                                     |
| `pnpm lint`             | ESLint across all packages                                                                   |
| `pnpm format:check`     | Verify Prettier formatting (`pnpm format` rewrites files)                                    |
| `pnpm typecheck`        | TypeScript strict checks across all packages                                                 |
| `pnpm test`             | Unit tests: shared (Vitest), API (Jest), web (Vitest)                                        |
| `pnpm test:integration` | API integration tests against a real PostgreSQL (`TEST_DATABASE_URL`)                        |
| `pnpm test:e2e`         | Builds everything, then runs the quick end-to-end set (1440 and 390 px); several minutes     |
| `pnpm test:e2e:full`    | Builds everything, then runs end-to-end tests at all five widths; about 17 minutes (2 cores) |
| `pnpm db:generate`      | Generate a SQL migration from schema changes (add `--custom --name=x` for raw SQL)           |
| `pnpm db:migrate`       | Build shared + API, then apply pending migrations to `DATABASE_URL`                          |

One-time setup for end-to-end tests: `pnpm --filter @smartpack/web exec playwright install chromium`.

## Build

```bash
pnpm build
```

- Web: `apps/web/.next`, started with `pnpm --filter @smartpack/web start`
- API: `apps/api/dist`, started with `pnpm --filter @smartpack/api start`
- Shared: `packages/shared/dist` (built automatically before the others)

## Repository structure

```
smartpack/
  apps/
    web/              Next.js application (App Router, Tailwind, design system)
    api/              NestJS + Fastify API, Drizzle schema and SQL migrations
  packages/
    shared/           Zod contracts and types used by both apps
    config/           Shared TypeScript, ESLint and Prettier configuration
  docs/               Architecture, security, API, routes, design system, components, setup, testing, reports
  docker/             Database initialisation for local Docker Compose
  .github/workflows/  Continuous integration
  docker-compose.yml  Local PostgreSQL + PostGIS
  CONTRIBUTING.md     Branch, commit and review conventions
```

## Documentation

- [Project architecture](docs/PROJECT_ARCHITECTURE.md)
- [Development setup](docs/DEVELOPMENT_SETUP.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Database setup](docs/DATABASE_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Phase 3 architecture](docs/PHASE_3_ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Authentication and sessions](docs/AUTHENTICATION.md)
- [Roles and permissions](docs/ACCESS_CONTROL.md)
- [First-owner bootstrap](docs/BOOTSTRAP.md)
- [Email](docs/EMAIL.md)
- [Rate limiting](docs/RATE_LIMITING.md)
- [Audit logging](docs/AUDIT_LOGGING.md)
- [API reference](docs/API_REFERENCE.md)
- [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)
- [Performance baseline](docs/PERFORMANCE.md)
- [Routes and modules](docs/ROUTES_AND_MODULES.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Components](docs/COMPONENTS.md)
- [Frontend and backend communication](docs/FRONTEND_BACKEND.md)
- [Responsive design](docs/RESPONSIVE_DESIGN.md)
- [Testing](docs/TESTING.md)
- [Deferred and not done](docs/DEFERRED.md)
- [Phase 1 report](docs/PHASE_1_REPORT.md)
- [Phase 2 report](docs/PHASE_2_REPORT.md)
- [Phase 3 report](docs/PHASE_3_REPORT.md)
- [Contributing](CONTRIBUTING.md)
