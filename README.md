# SmartPack Asset Intelligence Platform

SmartPack is a company platform for registering, identifying, verifying and tracking the company's
physical SmartPack backpacks, and for recording who holds each bag.

> **Status: Phase 1 — project foundation.** This repository currently contains the monorepo, the
> API foundation (health endpoint, validation, error handling, database connection and
> migrations), the web application shell and design system, and the test and CI setup. **None of
> the business modules exist yet** (SmartPacks, Workers, Verification, Tracking, Custody,
> Inspections, Alerts, Reports) and **there is no authentication**. The web app shows these modules
> as "Planned" and contains no company data. See [docs/PHASE_1_REPORT.md](docs/PHASE_1_REPORT.md).

## Technology

| Area             | Choice                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Monorepo         | pnpm workspaces                                                                             |
| Language         | TypeScript (strict) everywhere                                                              |
| Web              | Next.js (App Router), React, Tailwind CSS, Zod                                              |
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
- **PostgreSQL 16 with PostGIS** — via Docker Compose or a native install
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

## Development

```bash
pnpm dev
```

| Service           | URL                                               |
| ----------------- | ------------------------------------------------- |
| Web application   | http://localhost:3000                             |
| API               | http://localhost:4000/api/v1                      |
| Health endpoint   | http://localhost:4000/api/v1/health               |
| API documentation | http://localhost:4000/api/docs (development only) |

## Commands

All commands run from the repository root.

| Command                 | What it does                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm install`          | Install dependencies for every workspace package                                   |
| `pnpm dev`              | Run shared (watch), API (watch) and web (dev server) together                      |
| `pnpm build`            | Build shared, API and web for production                                           |
| `pnpm lint`             | ESLint across all packages                                                         |
| `pnpm format:check`     | Verify Prettier formatting (`pnpm format` rewrites files)                          |
| `pnpm typecheck`        | TypeScript strict checks across all packages                                       |
| `pnpm test`             | Unit tests: shared (Vitest), API (Jest), web (Vitest)                              |
| `pnpm test:integration` | API integration tests against a real PostgreSQL (`TEST_DATABASE_URL`)              |
| `pnpm test:e2e`         | Builds everything, then runs Playwright against the production build               |
| `pnpm db:generate`      | Generate a SQL migration from schema changes (add `--custom --name=x` for raw SQL) |
| `pnpm db:migrate`       | Build shared + API, then apply pending migrations to `DATABASE_URL`                |

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
  docs/               Architecture, setup, environment, database, deployment, phase report
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
- [Phase 1 report](docs/PHASE_1_REPORT.md)
- [Contributing](CONTRIBUTING.md)
