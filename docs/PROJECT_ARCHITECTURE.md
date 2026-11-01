# Project architecture

This document describes what exists after **Phase 2**, why it is built this way, and what is
deliberately not built yet. It is updated as the product grows. Phase 2 detail lives in
[ROUTES_AND_MODULES.md](ROUTES_AND_MODULES.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md),
[COMPONENTS.md](COMPONENTS.md) and [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md).

## 1. Scope

**Phase 1** built the foundation: repository, tooling, API skeleton, database connection and
migrations, tests and CI.

**Phase 2** built the web application proper: the design system, a responsive application shell,
every route and its layout, reusable components, and the real integration between the web app and
the API. No API or database change was needed.

**Not built (later phases):** authentication and authorisation, company and worker management,
SmartPack registration, QR and photo verification, GPS tracking, custody, inspections, alerts,
reports, offline support, and any GPS hardware integration. The business database schema is also
not designed yet: `apps/api/src/database/schema/` is intentionally empty, and the only migration
enables PostGIS. Every business page exists so its place in the product is fixed, but each one
states that its module is not built, names the phase that builds it, and holds no records.

## 2. System overview

```
┌────────────┐   HTTPS    ┌──────────────────────┐  server-side fetch   ┌──────────────────────┐
│  Browser   │ ─────────► │ Web  (Next.js 16)    │ ───────────────────► │ API  (NestJS/Fastify)│
└────────────┘            │ Vercel               │  GET /api/v1/health  │ separate Node host   │
                          └──────────────────────┘                      └──────────┬───────────┘
                                                                                   │ pg pool (TLS)
                                                                        ┌──────────▼───────────┐
                                                                        │ PostgreSQL + PostGIS │
                                                                        └──────────────────────┘
        packages/shared (Zod schemas + types) is imported by both the web app and the API.
```

The API and web app are **independently buildable and deployable**. They share only
`packages/shared`, which holds the contracts both sides must agree on.

## 3. Repository layout

| Path                           | Responsibility                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `apps/web`                     | Next.js App Router application                                                   |
| `apps/api`                     | NestJS API, Drizzle schema (`src/database/schema`), SQL migrations (`drizzle/`)  |
| `packages/shared`              | Zod schemas and inferred types: response/error envelopes, health report          |
| `packages/config`              | `tsconfig` presets, the shared ESLint flat-config factories, the Prettier preset |
| `docs`                         | This documentation                                                               |
| `docker`, `docker-compose.yml` | Optional local PostgreSQL + PostGIS                                              |
| `.github/workflows`            | CI                                                                               |

`packages/config` exists because three packages need the same strict compiler options and lint
rules; copying them would let them drift. `packages/shared` is compiled (`tsc`) to `dist/` and
consumed as a normal package, so the API (which runs on plain Node) and Next.js treat it
identically. Root scripts rebuild it first.

## 4. API (`apps/api`)

### 4.1 Structure

```
src/
  main.ts            validate config → create app → listen
  app.module.ts      composes the modules below
  app.setup.ts       prefix, security headers, CORS, request id, Swagger (shared with tests)
  config/            env schema (Zod), typed AppConfig, ConfigModule
  common/            error mapping, exception filter, response envelope, validation pipe, request id
  logging/           pino logger configuration
  database/          pool, DatabaseService, error summariser, migration runner, Drizzle schema
  health/            GET /health (controller, service, OpenAPI schema)
test/                integration tests against real PostgreSQL
drizzle/             generated SQL migrations + drizzle-kit metadata
```

Future business modules (`workers`, `smartpacks`, …) will each be a Nest module beside `health/`.

### 4.2 Conventions

| Concern      | Convention                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix       | Everything is under `/api/v1`; documentation is at `/api/docs` (outside the prefix)                                                                                                                      |
| Success body | `{ "data": <payload> }`, added by one global interceptor                                                                                                                                                 |
| Error body   | `{ "error": { code, message, statusCode, requestId, details? } }`, produced by one global filter                                                                                                         |
| Error codes  | A closed set (`VALIDATION_FAILED`, `NOT_FOUND`, `INTERNAL_ERROR`, …) defined in `packages/shared`; clients branch on `code`, not `message`                                                               |
| Request id   | Every response carries `x-request-id`, repeated in error bodies and logs. A caller-supplied id is kept only if it matches `[A-Za-z0-9._-]{8,64}`; otherwise a UUID is generated (prevents log injection) |
| Validation   | Handlers declare Zod schemas: `@Query({ schema })`, `@Body({ schema })`. Nest 12's built-in Standard Schema pipe runs them; failures become `400 VALIDATION_FAILED` with per-field `details`             |
| Status codes | 200/201 success, 400 validation or bad JSON, 404 unknown route, 413 body over 1 MiB, 503 database down, 500 unexpected                                                                                   |
| Contracts    | Response schemas live in `packages/shared`; the health OpenAPI schema is generated from the same Zod schema, so documentation cannot drift from behaviour                                                |

### 4.3 Request lifecycle

1. Fastify assigns the request id.
2. Helmet and CORS apply headers; the `onSend` hook echoes `x-request-id`.
3. `nestjs-pino` logs the request (path only, never the query string; `authorization`/`cookie`
   headers redacted).
4. The validation pipe checks any declared schemas.
5. The handler runs; the envelope interceptor wraps the result.
6. Any thrown value goes through the exception filter. **Production** responses to 5xx errors are
   generic; the full error is logged server-side only.

### 4.4 Configuration

All environment variables are parsed once at start-up by a Zod schema (`config/env.schema.ts`)
into an immutable, typed `AppConfig`, which is injected where needed. Nothing reads `process.env`
elsewhere. Invalid configuration prints variable names (never values) and exits with status 1
before the framework starts. See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

### 4.5 Database layer

- `node-postgres` pool wrapped by Drizzle ORM. The pool opens connections lazily, so the API starts
  even when the database is down and reports it honestly through `/health`.
- Limits: connection timeout, per-query client timeout and server `statement_timeout`.
- The pool's `error` event is handled; without a listener a dropped idle connection would crash
  the process.
- Database errors are logged as `code: first-line-of-message` of the **root cause**; the full
  error object is never logged, because driver errors can embed connection details.
- TLS is controlled only by `DATABASE_SSL` (URL `sslmode` is rejected, see
  [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)).
- Migrations are SQL files generated by `drizzle-kit` and applied by a separate command
  (`pnpm db:migrate`), never at API start.

### 4.6 Health endpoint

`GET /api/v1/health` runs `select exists (select 1 from pg_extension where extname = 'postgis')`
on every call, bounded by a 3 second timeout, and reports `ok` / `degraded` / `error` with HTTP
200 / 200 / 503. It is never cached (`Cache-Control: no-store`). Nothing about the database
connection (host, error text) appears in the response. This was verified by stopping PostgreSQL
under a running API: the endpoint returned 503 immediately and recovered when the database came back.

### 4.7 Logging

Structured JSON lines in production, readable output in development (`pino-pretty`). Successful
health probes log at `debug` so orchestrator polling does not flood the log. pino-http's synthetic
5xx error stack is replaced with the message only; real failures are logged with their stack by the
exception filter.

## 5. Web application (`apps/web`)

### 5.1 Routes

The full table, with the backend each page is waiting for, is in
[ROUTES_AND_MODULES.md](ROUTES_AND_MODULES.md). In summary:

- `(public)` group: `/` (landing), `/login`, `/privacy`, `/terms`.
- `(app)` group, inside the application shell: `/dashboard` (Overview) and
  `/dashboard/{smartpacks,workers,verification,tracking,custody,inspections,alerts,reports,settings,help}`.
- `not-found` for unknown paths; `manifest.webmanifest`, `robots.txt`, icons.

**None of the `(app)` routes is protected**: authentication does not exist yet, and an amber banner
on every page says so. A later phase adds the guard around the `(app)` layout.

### 5.2 Rendering model

Server Components by default. Client components exist only where interaction requires them:
navigation state (`nav-list`, `mobile-nav`), dialogs, drawers, tabs, menus and toasts, the form
fields that hold input or visibility state, the sign-in form, the refresh button and the
diagnostics dialog, and the Next.js error boundary.

**Every page is rendered per request.** The root layout reads the optional `BRAND_*` environment
variables with `connection()`, and the Overview and Help pages fetch live API data. This is a
deliberate trade: branding can change without a rebuild, at the cost of no prerendered HTML.

Data is fetched **on the server** by `lib/api/client.ts` (`apiGet`): `cache: 'no-store'`, a 4 second
timeout, an `x-request-id` header, and validation against the shared Zod contract. Every failure
(`unconfigured`, `unreachable` with a timeout or network reason, `http-error`, `invalid-response`)
is a described result that the page renders as an explicit state; the function never throws and
never reports success it did not observe. A 503 with a valid health body is shown as
"Database unavailable", not as "API unreachable". See [FRONTEND_BACKEND.md](FRONTEND_BACKEND.md).

### 5.3 Navigation honesty

`lib/modules.ts` is the single registry behind the sidebar, the mobile drawer, breadcrumbs, the
landing page table and the Help page. A module is `available` only when it works end to end; today
that is **Overview** and **Help & Documentation**. The other nine are `planned`: they are real links
to real pages, so the structure can be reviewed, but they carry a "Planned" tag, a
"Planned for Phase N" badge and a "Not available in this build" notice, and every control that
would act on records is disabled with the reason stated. Promoting a module is a deliberate edit
to the registry; a test asserts that every registered route has a page.

The mapping of modules to phases is the project's own plan, made in Phase 2, and needs owner
approval.

### 5.4 Responsive shell

- From `lg` (1024 px): a fixed 256 px navigation rail, a top bar with the Help menu, and a content
  column (maximum 72 rem) with Main and Secondary navigation groups.
- Below `lg`: the rail is hidden; a menu button opens the same navigation in a drawer built on the
  native `<dialog>` element (focus trap, Escape, focus return, background inert). The drawer closes
  after navigation. Controls grow to 44 px on touch devices.
- Record lists use a table from `md` (or `xl` when there are five or more columns) and a list of
  labelled cards below that, so no table is squeezed or clipped on a tablet.
- Verified in Chromium at 1440, 1280, 768, 390 and 360 px; see [TESTING.md](TESTING.md) and
  [RESPONSIVE_DESIGN.md](RESPONSIVE_DESIGN.md).

### 5.5 Design system

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for colour, typography, spacing, icons, states and
accessibility, and [COMPONENTS.md](COMPONENTS.md) for the component inventory. In short: a
restrained, document-like enterprise look with one accent; Tailwind's default theme is cleared so
only project tokens exist; fonts are self-hosted; icons are drawn in-house; contrast is enforced by
a test.

### 5.6 Progressive web app foundations

Present: web app manifest (standalone display, name, theme colours, 192/512 and maskable icons),
Apple touch icon, theme colour. **Not present, deliberately:** a service worker. Caching pages that
will carry private asset and custody data needs the authentication and data-sensitivity design
first; a naive service worker could expose one user's data to the next. Install-to-home-screen
behaviour on real devices has not been tested.

## 6. Security

### Implemented (Phases 1 and 2)

- No secrets in code; `.env*` ignored by Git, only placeholder `*.example` files tracked.
- Environment validated at start-up; errors never print values.
- API: Helmet headers (`default-src 'none'` CSP for the JSON API, `frame-ancestors 'none'`,
  `nosniff`, `no-referrer`, same-origin resource policy), HSTS in production, CORS allow-list
  (credentials disabled), 1 MiB body limit, input validation, generic 5xx messages in production,
  log redaction, request ids, Swagger off in production by default.
- Web: `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Permissions-Policy` disabling
  camera/microphone/geolocation/payment, HSTS in production, `X-Powered-By` removed, pages marked
  `noindex` (with `robots.txt` disallow), `API_URL` kept server-side.
- Web (Phase 2): the sign-in form sends nothing anywhere, clears the password after a check and
  stays disabled until the page has hydrated so a password can never be placed in a URL; branding
  variables are validated, and an accent colour that fails contrast is ignored; the diagnostics text
  copied from the Help menu contains no secrets or connection strings.
- Database: TLS required by default in production; query and connection timeouts; restricted-role
  guidance.
- Supply chain: exact dependency versions, committed lockfile, `--frozen-lockfile` in CI.

### Remaining security work (not done)

This system is **not** secure enough for real company data before Phase 3.

1. **Authentication and authorisation** (sessions or tokens, password/credential handling, roles,
   protected routes and API endpoints, brute-force protection). Nothing is protected today.
2. **Rate limiting** and abuse protection on the API.
3. **Content-Security-Policy `script-src`** for the web app (needs nonces; chosen together with auth).
4. **CSRF strategy** if cookie sessions are used; CORS credentials remain disabled until then.
5. **Audit logging** of administrative and custody actions.
6. Photo and QR handling: upload limits, content-type verification, malware/size policy, storage
   access control, signed URLs.
7. Least-privilege database roles and row-level considerations; backup and restore procedure.
8. Dependency vulnerability scanning and automated updates in CI.
9. Security review/penetration test before production use; privacy review of worker location data.
10. Secret rotation procedure and production secret management.
11. The health endpoint is public and reports the API version, environment name, uptime and
    database latency (and the dashboard shows them publicly). Before production, split a minimal
    public liveness check from a detailed status view that requires authentication.

## 7. Testing strategy

| Layer                | Tool                     | What it covers                                                                                                                            |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts     | Vitest                   | Schema acceptance and rejection                                                                                                           |
| API units            | Jest                     | Config validation, request ids, error mapping, error summaries, health logic                                                              |
| API integration      | Jest + Supertest         | The real app against real PostgreSQL: health up/down/degraded, envelopes, validation, headers, CORS, OpenAPI, production hardening        |
| Web units/components | Vitest + Testing Library | Design-token contrast, module registry, API client, branding, status views, form fields, dialogs, drawers, tabs, menus, toasts, shell     |
| End to end           | Playwright (Chromium)    | Production build + real API + real DB at 1440, 1280, 768, 390 and 360 px: every route, navigation, forms, dialogs, axe, API failure modes |

The "database unreachable" and "PostGIS missing" health paths are exercised against real servers
(a closed port; a scratch database without the extension), not mocks.

## 8. Technical decisions

| Decision                                             | Reason                                                                                                                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm workspaces, `engine-strict`, exact versions     | One reproducible install; fail early on unsupported Node                                                                                                                                                              |
| **TypeScript 6.0.3**, not 7                          | `typescript-eslint` 8 supports `<6.1` and the Nest CLI depends on `~6.0`                                                                                                                                              |
| **ESLint 9**, not 10                                 | Required plugins (`eslint-plugin-react`, `jsx-a11y`, via `eslint-config-next`) do not declare ESLint 10 support                                                                                                       |
| **NestJS 12** (ESM-only)                             | Current stable; ships a Standard Schema validation pipe, so Zod is used without `class-validator`                                                                                                                     |
| Zod schemas in `packages/shared`                     | A single definition gives runtime validation, TypeScript types and OpenAPI schema; the web app validates API responses with the same schema                                                                           |
| No `class-validator` / `class-transformer`           | Not needed with Standard Schema; fewer dependencies                                                                                                                                                                   |
| Drizzle ORM + generated SQL migrations               | Type-safe queries, plain reviewable SQL, PostGIS added by a custom SQL migration                                                                                                                                      |
| Migrations as a separate command                     | Avoids startup races and hidden schema changes                                                                                                                                                                        |
| `pg` pool, not `postgres`                            | Mature, explicit pool controls and timeouts; supported by Drizzle                                                                                                                                                     |
| Jest 30 for the API (per the brief), run in ESM mode | The API is ESM-only. One test-only shim loads `content-disposition` (ESM-only, needed by Swagger's static assets) through Node's loader because Jest cannot require ESM before Node 24.9; documented in `test/shims/` |
| Vitest 5 + Vite 8 for web/shared                     | Fast, ESM-native, same API for both                                                                                                                                                                                   |
| Native `<dialog>` for the mobile drawer              | Correct focus trap and Escape handling without a library                                                                                                                                                              |
| Tailwind with a cleared theme                        | Prevents accidental off-system styling                                                                                                                                                                                |
| Self-hosted fonts                                    | No third-party requests; no build-time network dependency; licences kept in repo                                                                                                                                      |
| No icon library, no service worker                   | See 5.5 and 5.6                                                                                                                                                                                                       |
| `typedRoutes`                                        | Broken internal links fail the type check                                                                                                                                                                             |
| Planned modules are pages, not inert labels          | Phase 2 needs every screen reviewable; honesty comes from labels, notices and disabled controls rather than from hiding the page                                                                                      |
| Runtime branding from server environment variables   | A company name, logo and accent can change without a rebuild; invalid values are ignored with a note. Cost: all pages are rendered per request                                                                        |
| Native `<dialog>` for dialogs and drawers            | One accessible primitive for modal behaviour instead of a library                                                                                                                                                     |
| Sign-in validates but sends nothing                  | No fake authentication; the form shows how input is checked and states plainly that sign-in is not enabled                                                                                                            |
| `@axe-core/playwright` (dev dependency)              | Automated WCAG 2.2 AA checks on every route                                                                                                                                                                           |
| API dev uses `node --env-file-if-exists`             | Reads `.env` without an extra dependency                                                                                                                                                                              |

## 9. Known limitations and open questions

- `ConfirmDialog` is built and tested but no screen uses it yet, because no destructive action exists.
  A tooltip component was not built: nothing needed one.
- Settings is read-only: it shows the company profile taken from the `BRAND_*` variables.
- The privacy and terms pages are placeholders that say they are not published. Legal text is the
  company's to supply.
- The module-to-phase mapping (SmartPacks 4, Workers and Custody 5, Verification and Inspections 6,
  Tracking 7, Alerts 8, Reports 9, Settings 3) is a proposal.
- GPS: only PostGIS is enabled. How positions from phones and from future hardware are ingested
  (and which sources "available GPS sources" means in practice) is to be specified in the
  architecture phase; no capability has been assumed.
- Docker image, Vercel configuration and the CI workflow are written but could not be exercised in
  the build environment (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- Tests ran on Chromium only, with viewport emulation. Firefox, Safari, physical devices and a
  manual screen-reader audit were not covered. See [TESTING.md](TESTING.md).
