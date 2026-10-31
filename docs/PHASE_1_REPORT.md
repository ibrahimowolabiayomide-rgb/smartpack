# Phase 1 report — project foundation and development environment

**Status: implementation complete and self-verified; awaiting owner verification and approval.**
Phase 2 has not been started.

Verification environment: Ubuntu 24.04, Node 22.23.4, pnpm 10.28.0, PostgreSQL 16.15 with PostGIS
3.4.2, Chromium 153 (see limitations). Every result below comes from a run of the commands shown,
executed in a **clean copy containing only the files Git would commit**, after a fresh
`pnpm install --frozen-lockfile`.

## 1. What was created

- **Monorepo**: pnpm workspace with `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- **API** (NestJS 12 on Fastify): validated configuration, `/api/v1` prefix, `GET /api/v1/health`
  with a live database and PostGIS probe, structured logging with redaction, global exception
  handling with a fixed error envelope, request IDs, Zod request validation, Helmet security
  headers, CORS allow-list, Swagger at `/api/docs`.
- **Database foundation**: PostgreSQL pool, Drizzle ORM, SQL migration tooling, one migration that
  enables PostGIS. **No business tables** (the schema is intentionally empty).
- **Web** (Next.js 16, App Router): routes `/`, `/login`, `/dashboard`; responsive application
  shell (desktop sidebar, mobile drawer, top bar, breadcrumbs); design tokens; self-hosted fonts;
  in-house icons; reusable components (button, form field, empty / loading / error states, status
  badge, notice, panel, table); a live platform-status panel fed by the real API; PWA manifest and
  icons.
- **Shared contracts** (Zod): success/error envelopes and the health report.
- **Quality tooling**: ESLint, Prettier, strict TypeScript, Vitest, Jest + Supertest, Playwright.
- **Delivery files**: GitHub Actions CI, Vercel configuration, API Dockerfile, Docker Compose for a
  local database, `.env.example` files, README, CONTRIBUTING, six documents in `docs/`.

**Honesty rules observed**: `/login` is an inert, clearly labelled placeholder; the nine business
modules appear only as "Planned" and are not links; the dashboard contains no invented data; a test
asserts that no module without a page is clickable.

## 2. Exact folder structure

153 files plus this report (and the `.gitattributes` added in revision 2, below). Generated and ignored folders (`node_modules`, `dist`, `.next`, local
`.env` files) are not listed.

```
smartpack/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .vscode/
│   └── extensions.json
├── apps/
│   ├── api/
│   │   ├── drizzle/
│   │   │   ├── meta/   (drizzle-kit snapshot + journal)
│   │   │   └── 0000_enable_postgis.sql
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── errors/
│   │   │   │   │   ├── map-exception.spec.ts
│   │   │   │   │   ├── map-exception.ts
│   │   │   │   │   └── validation-failed.exception.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── all-exceptions.filter.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── response-envelope.interceptor.ts
│   │   │   │   ├── common.module.ts
│   │   │   │   ├── request-id.spec.ts
│   │   │   │   └── request-id.ts
│   │   │   ├── config/
│   │   │   │   ├── app-config.spec.ts
│   │   │   │   ├── app-config.ts
│   │   │   │   ├── app-info.ts
│   │   │   │   ├── config.constants.ts
│   │   │   │   ├── config.module.ts
│   │   │   │   └── env.schema.ts
│   │   │   ├── database/
│   │   │   │   ├── schema/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── database.module.ts
│   │   │   │   ├── database.service.ts
│   │   │   │   ├── error-summary.spec.ts
│   │   │   │   ├── error-summary.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   ├── pool.ts
│   │   │   │   └── run-migrations.ts
│   │   │   ├── health/
│   │   │   │   ├── health.controller.ts
│   │   │   │   ├── health.module.ts
│   │   │   │   ├── health.service.spec.ts
│   │   │   │   ├── health.service.ts
│   │   │   │   └── openapi.ts
│   │   │   ├── logging/
│   │   │   │   └── logging.module.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.setup.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── shims/
│   │   │   │   └── content-disposition.cjs
│   │   │   ├── health.integration.spec.ts
│   │   │   ├── helpers.ts
│   │   │   └── http-conventions.integration.spec.ts
│   │   ├── .env.example
│   │   ├── .env.test.example
│   │   ├── Dockerfile
│   │   ├── drizzle.config.ts
│   │   ├── eslint.config.mjs
│   │   ├── jest.config.mjs
│   │   ├── jest.integration.config.mjs
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   └── web/
│       ├── e2e/
│       │   └── smoke.spec.ts
│       ├── public/
│       │   └── icons/
│       │       ├── icon-192.png
│       │       ├── icon-512.png
│       │       └── icon-maskable-512.png
│       ├── src/
│       │   ├── app/
│       │   │   ├── (app)/
│       │   │   │   ├── dashboard/
│       │   │   │   │   ├── error.tsx
│       │   │   │   │   ├── loading.tsx
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (public)/
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── layout.tsx
│       │   │   │   └── page.tsx
│       │   │   ├── fonts/   (9 files: 6 woff2 fonts + 3 licence texts)
│       │   │   ├── apple-icon.png
│       │   │   ├── fonts.ts
│       │   │   ├── globals.css
│       │   │   ├── icon.svg
│       │   │   ├── layout.tsx
│       │   │   ├── manifest.ts
│       │   │   ├── not-found.tsx
│       │   │   └── robots.ts
│       │   ├── components/
│       │   │   ├── brand/
│       │   │   │   └── wordmark.tsx
│       │   │   ├── icons/
│       │   │   │   └── index.tsx
│       │   │   ├── shell/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── mobile-nav.tsx
│       │   │   │   ├── nav-list.tsx
│       │   │   │   ├── shell.test.tsx
│       │   │   │   ├── sidebar.tsx
│       │   │   │   └── top-bar.tsx
│       │   │   └── ui/
│       │   │       ├── breadcrumbs.tsx
│       │   │       ├── button.tsx
│       │   │       ├── data-table.tsx
│       │   │       ├── empty-state.tsx
│       │   │       ├── error-state.tsx
│       │   │       ├── loading-state.tsx
│       │   │       ├── notice.tsx
│       │   │       ├── page-title.tsx
│       │   │       ├── panel.tsx
│       │   │       ├── status-badge.tsx
│       │   │       ├── text-field.tsx
│       │   │       └── ui.test.tsx
│       │   ├── features/
│       │   │   └── platform-status/
│       │   │       ├── platform-status-view.test.tsx
│       │   │       ├── platform-status-view.tsx
│       │   │       └── platform-status.tsx
│       │   ├── lib/
│       │   │   ├── api-health.test.ts
│       │   │   ├── api-health.ts
│       │   │   ├── app-info.ts
│       │   │   ├── cn.ts
│       │   │   ├── modules.test.ts
│       │   │   └── modules.ts
│       │   └── styles/
│       │       ├── tokens.css
│       │       └── tokens.test.ts
│       ├── .env.example
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── package.json
│       ├── playwright.config.ts
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       ├── vercel.json
│       ├── vitest.config.ts
│       └── vitest.setup.ts
├── docker/
│   └── db-init/
│       └── 01-create-test-database.sql
├── docs/
│   ├── DATABASE_SETUP.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT_SETUP.md
│   ├── ENVIRONMENT_VARIABLES.md
│   └── PROJECT_ARCHITECTURE.md
├── packages/
│   ├── config/
│   │   ├── eslint/
│   │   │   └── index.mjs
│   │   ├── tsconfig/
│   │   │   ├── base.json
│   │   │   ├── nextjs.json
│   │   │   └── node.json
│   │   ├── eslint.config.mjs
│   │   ├── package.json
│   │   └── prettier.mjs
│   └── shared/
│       ├── src/
│       │   ├── contracts.test.ts
│       │   ├── envelope.ts
│       │   ├── health.ts
│       │   └── index.ts
│       ├── eslint.config.mjs
│       ├── package.json
│       ├── tsconfig.build.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── .dockerignore
├── .gitignore
├── .node-version
├── .npmrc
├── .prettierignore
├── CONTRIBUTING.md
├── README.md
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## 3. Technologies and versions

| Area       | Package                                               | Version                                   |
| ---------- | ----------------------------------------------------- | ----------------------------------------- |
| Runtime    | Node.js / pnpm                                        | 22.23.4 (≥ 22.12 required) / 10.28.0      |
| Language   | TypeScript                                            | 6.0.3                                     |
| Web        | Next.js / React / Tailwind CSS                        | 16.4.3 / 19.3.1 / 4.3.3                   |
| API        | NestJS (core, platform-fastify) / Fastify / Swagger   | 12.3.2 / 5.12.7 / 12.0.5                  |
| Logging    | pino / nestjs-pino                                    | 10.4.0 / 5.3.1                            |
| Database   | PostgreSQL / PostGIS / pg / Drizzle ORM / drizzle-kit | 16.15 / 3.4.2 / 8.23.1 / 0.45.4 / 0.31.11 |
| Validation | Zod                                                   | 4.6.7                                     |
| Tests      | Vitest / Jest / ts-jest / Supertest / Playwright      | 5.0.5 / 30.5.2 / 29.4.15 / 7.3.1 / 1.64.1 |
| Quality    | ESLint / Prettier                                     | 9.39.5 / 3.9.10                           |
| Fonts      | IBM Plex Sans, IBM Plex Mono, Source Serif 4          | SIL OFL 1.1, self-hosted                  |

Choices that depart from "latest" and why: TypeScript 6.0 (typescript-eslint and the Nest CLI do
not support 7 yet) and ESLint 9 (the React and accessibility lint plugins do not support 10 yet).
**Note:** `pnpm install` prints that `eslint@9.39.5` is marked deprecated by its maintainers; revisit
when the plugins support ESLint 10. Full reasoning: [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) §8.

## 4. Commands to install and run

```bash
corepack enable
pnpm install
cp apps/api/.env.example        apps/api/.env
cp apps/api/.env.test.example   apps/api/.env.test.local
cp apps/web/.env.example        apps/web/.env.local
# create PostgreSQL databases and set DATABASE_URL / TEST_DATABASE_URL (docs/DATABASE_SETUP.md)
pnpm db:migrate
pnpm dev          # web http://localhost:3000, API http://localhost:4000/api/v1/health
```

## 5. Commands used for testing

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                  # unit tests: shared, API, web
pnpm build
pnpm db:migrate            # against the test database
pnpm test:integration      # API against real PostgreSQL
pnpm test:e2e              # Playwright against the production build, real API, real database
```

## 6. Actual test results

Clean copy, fresh frozen-lockfile install, Node 22.23.4:

| Command                                                 | Result                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm format:check`                                     | pass                                                                                   |
| `pnpm lint` (4 packages)                                | pass, 0 errors, 0 warnings                                                             |
| `pnpm typecheck` (3 packages)                           | pass                                                                                   |
| `pnpm test` — shared (Vitest)                           | 10 passed                                                                              |
| `pnpm test` — API (Jest, 5 suites)                      | 64 passed                                                                              |
| `pnpm test` — web (Vitest, 6 files)                     | 83 passed                                                                              |
| `pnpm build`                                            | pass (shared, API, web)                                                                |
| `pnpm db:migrate`                                       | pass                                                                                   |
| `pnpm test:integration` (2 suites)                      | 31 passed                                                                              |
| `pnpm test:e2e` (Chromium: desktop + Pixel 7 emulation) | 27 passed, 3 skipped (viewport-specific tests, skipped by design on the other project) |

**Totals: 157 unit, 31 integration, 27 end-to-end.**

Additional manual checks performed (not automated):

- **Database health, verified live**: with PostgreSQL stopped under a running API, `/api/v1/health`
  returned **503** with `database: down`, the process stayed alive, and it returned **200** again
  after PostgreSQL restarted. With PostGIS absent (scratch database) it returns 200 `degraded`.
  (Both paths are also automated against real servers.)
- **Production bundle**: `pnpm deploy --prod` output ran on its own: applied its migration, started
  with `NODE_ENV=production`, sent HSTS, returned 404 for `/api/docs`, logged JSON, and refused to
  start on an invalid `DATABASE_URL` (exit 1, no secret in the message).
- **Layouts**: screenshots reviewed at 1440×900 and 390×844 for `/`, `/login`, `/dashboard`, and the
  open mobile drawer: no horizontal overflow, no console errors.
- **`pnpm dev`**: web, API and shared watcher start together; the dashboard shows live status.
- **Secrets**: the 153 committable files were scanned; no `.env` file other than `*.example`, and
  the local database password appears in none of them.

## 7. Unresolved issues and limitations

1. **Docker artifacts unverified.** `docker-compose.yml` passes `docker compose config` only; the
   build environment had no Docker daemon, so neither the Compose database nor `apps/api/Dockerfile`
   was run. (The bundle the Dockerfile produces _was_ verified.)
2. **CI workflow unverified.** It parses as YAML and mirrors the commands above, but it will first
   run on your first push. The GitHub Action versions (`checkout@v4`, `setup-node@v4`,
   `pnpm/action-setup@v4`, `upload-artifact@v4`) should be checked against current releases.
3. **Vercel configuration unverified.** `apps/web/vercel.json` and the monorepo settings in
   [DEPLOYMENT.md](DEPLOYMENT.md) need a Vercel project to confirm.
4. **Playwright used a substitute browser here.** Playwright's download host was blocked, so tests
   ran on a Chromium 153 binary via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. On your machine run
   `pnpm --filter @smartpack/web exec playwright install chromium` and leave the variable unset;
   this path was not exercised here.
5. **"Mobile" is emulation.** Chromium with a Pixel 7 profile; no physical phone, Safari, Firefox
   or Windows machine was tested, and PWA installation on a device was not tested.
6. **Accessibility** is covered by contrast tests, semantic markup and keyboard tests, but no
   automated rule engine (axe) or screen-reader audit was run.
7. **Jest cannot load one ESM-only dependency** (`content-disposition`, used by Swagger's static
   files) before Node 24.9, so a small test-only shim loads it natively. Production is unaffected.
   See `apps/api/test/shims/content-disposition.cjs`.
8. **Next.js telemetry** is enabled by default (anonymous); set `NEXT_TELEMETRY_DISABLED=1` to opt out.
9. **Not a secure system yet.** There is no authentication; `/dashboard` and the health endpoint are
   public. The full list of remaining security work is in [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) §6.
10. `EmptyState` is built and unit-tested but is not shown anywhere, because no list screen exists yet.
11. Nothing has been committed or pushed, and nothing has been deployed (see sections 9 and 10).

## 8. Required environment variables

Full reference: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

| Where | Variable                                                                                                                                                       | Required                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| API   | `DATABASE_URL`                                                                                                                                                 | always                               |
| API   | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `ENABLE_API_DOCS`, `DATABASE_SSL`, `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_QUERY_TIMEOUT_MS` | optional, with defaults              |
| API   | `CORS_ALLOWED_ORIGINS`                                                                                                                                         | required in production (https only)  |
| Web   | `API_URL`                                                                                                                                                      | required in production and preview   |
| Tests | `TEST_DATABASE_URL`                                                                                                                                            | for integration and end-to-end tests |

## 9. GitHub status

- Git repository initialised on branch `main`. **No commit has been made and nothing has been
  pushed.** You have not yet provided a repository URL or authentication.
- Ready for the initial commit: `.gitignore` (env files, build output, caches), no `node_modules`,
  no generated folders, no secrets, `.env*.example` files tracked, CI workflow and conventions
  ([CONTRIBUTING.md](../CONTRIBUTING.md)) in place.
- When ready:

  ```bash
  git add -A
  git commit -m "chore: phase 1 project foundation"
  git remote add origin https://github.com/<owner>/<repository>.git
  git push -u origin main
  ```

## 10. Vercel deployment status

**Not deployed.** The production build of the web app passes and the configuration and steps are
written ([DEPLOYMENT.md](DEPLOYMENT.md), `apps/web/vercel.json`), but no Vercel project exists and
the settings are unverified (limitation 3). The backend is documented as a separate long-running
Node service; hosting options and requirements are in the same document.

## 11. Files changed

Initial creation: all 153 files in the structure above, plus this report. No pre-existing code
existed.

## 12. Manual actions required from the owner

1. Install the tools in section 4 and set up PostgreSQL 16 + PostGIS ([DATABASE_SETUP.md](DATABASE_SETUP.md)).
2. Run the verification commands in section 5 and review the pages at desktop and mobile widths.
3. Install the Playwright browser (limitation 4) and run `pnpm test:e2e`.
4. Provide the GitHub repository URL and authenticate, then make the first commit and push.
5. Confirm the CI run on GitHub passes (limitation 2).
6. Create the Vercel project and a backend host plus production database when you want to deploy
   ([DEPLOYMENT.md](DEPLOYMENT.md)).
7. Review and decide the open questions that affect Phase 2: how GPS data from phones and future
   hardware is to be ingested, and the authentication approach.
8. Approve Phase 1 (or list changes). Phase 2 begins only after approval.

## Revision 2 — corrections found while preparing the Windows installation

Writing the Windows installation guide meant re-reading the archive as a new machine would, and
four defects surfaced. None changes behaviour; all are fixed in archive `smartpack-phase-1-review-r2.zip`.

1. **`pnpm db:migrate` failed on a fresh checkout.** It runs `dist/database/migrate.js`, which only
   exists after a build, yet the README, `DATABASE_SETUP.md` and the CI workflow ran it first.
   _Reproduced_ (`Cannot find module …/dist/database/migrate.js`). _Fix:_ the root script now builds
   `@smartpack/shared` and `@smartpack/api` first. _Verified:_ from a tree with no build output it
   applies the migration, and a second run is a no-op. Production paths (Dockerfile, `DEPLOYMENT.md`)
   call `node dist/database/migrate.js` directly and are unchanged.
2. **Windows line endings.** Git for Windows defaults to `core.autocrlf=true`, which would give
   checkouts CRLF endings and make `pnpm format:check` fail (Prettier requires LF). Added
   `.gitattributes` (`* text=auto eol=lf`, binary assets pinned).
3. **`.gitignore` did not exclude `*.zip`.** Added, so archives cannot be committed by accident.
4. **Vercel pnpm version.** Per Vercel's documentation, an override install command (ours) uses the
   oldest pnpm available. `ENABLE_EXPERIMENTAL_COREPACK=1` is now a documented step in
   `DEPLOYMENT.md`. Still **unverified** until a Vercel project exists.

Re-verified after these changes: `pnpm format:check`, and `pnpm db:migrate` from a tree without
build output. The full lint, type-check, unit, integration and end-to-end suites were not re-run,
because none of the changed files is compiled or tested; the owner's installation will run them.

## Completion checklist

- [x] Monorepo created
- [x] pnpm workspace working
- [x] Next.js application working
- [x] NestJS application working
- [x] PostgreSQL configuration working (local PostgreSQL 16 + PostGIS; Docker path unverified)
- [x] Database health check verified (up → 200, down → 503, PostGIS missing → degraded)
- [x] Initial design system established
- [x] Desktop layout verified (Chromium, 1440×900)
- [x] Mobile layout verified (Chromium emulation, 390×844 and Pixel 7; no physical device)
- [x] Responsive navigation verified
- [x] Environment examples provided
- [x] Secrets excluded from Git
- [x] ESLint passes
- [x] Prettier checks pass
- [x] TypeScript checks pass
- [x] Unit tests pass
- [x] API tests pass (unit and integration)
- [x] Production build passes
- [x] Playwright smoke tests pass (with the substitute browser noted above)
- [x] Documentation completed
- [x] GitHub preparation completed (prepared; not committed or pushed)
- [x] Vercel deployment preparation completed (prepared; **not deployed, configuration unverified**)
