# Project architecture

This document describes what exists after **Phase 1**, why it is built this way, and what is
deliberately not built yet. It is updated as the product grows.

## 1. Scope of Phase 1

Phase 1 builds the foundation only: repository, tooling, API skeleton, database connection and
migrations, web application shell, design system, tests and CI.

**Not built (later phases):** authentication and authorisation, company and worker management,
SmartPack registration, QR and photo verification, GPS tracking, custody, inspections, alerts,
reports, offline support, and any GPS hardware integration. The business database schema is also
not designed yet: `apps/api/src/database/schema/` is intentionally empty, and the only migration
enables PostGIS.

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
| Success body | `{ "data": <payload> }` — added by one global interceptor                                                                                                                                                |
| Error body   | `{ "error": { code, message, statusCode, requestId, details? } }` — produced by one global filter                                                                                                        |
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

| Route                                                                  | Group      | Rendering   | Purpose                                                                |
| ---------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------------------------------------- |
| `/`                                                                    | `(public)` | static      | Product entry point; states what is implemented and what is not        |
| `/login`                                                               | `(public)` | static      | **Inert placeholder.** All controls disabled; nothing is sent anywhere |
| `/dashboard`                                                           | `(app)`    | per request | Application shell with a live platform-status panel                    |
| `/manifest.webmanifest`, `/robots.txt`, `/icon.svg`, `/apple-icon.png` | —          | static      | PWA manifest, crawler exclusion, icons                                 |

The `(public)` and `(app)` route groups let the shell wrap every future signed-in page through a
single layout. **`/dashboard` is not protected**: authentication does not exist yet, and the page
says so in a visible notice. A later phase will add the guard around the `(app)` layout.

### 5.2 Rendering model

Server Components by default. Client components exist only where interaction requires them:

| File                              | Why it is a client component                       |
| --------------------------------- | -------------------------------------------------- |
| `components/shell/nav-list.tsx`   | Reads the current path to mark the active item     |
| `components/shell/mobile-nav.tsx` | Opens/closes the drawer, closes on navigation      |
| `app/(app)/dashboard/error.tsx`   | Next.js error boundaries must be client components |

The dashboard fetches health data **on the server** (`lib/api-health.ts`), with `cache: 'no-store'`
and a 4 second timeout, and validates the response against the shared Zod contract. Every failure
(`unconfigured`, `unreachable`, `http-error`, `invalid-response`) is a described result that the
page renders as an explicit error state; the function never throws and never reports success it
did not observe. A 503 with a valid health body is shown as "Database unavailable", not as "API
unreachable".

### 5.3 Navigation honesty

`lib/modules.ts` is the registry of navigation modules. A module is `available` only when its page
exists; today only **Overview**. The nine others render as inert labelled "Planned" items (not links,
`aria-disabled`, with screen-reader text "not yet available"). Promoting a module is a deliberate
edit that sets `status` and `href` together; tests assert that no planned module has a route.

### 5.4 Responsive shell

- From the `lg` breakpoint (1024 px): fixed 256 px navigation rail, top bar, content column
  (max 64 rem).
- Below `lg`: the rail is hidden; a menu button opens the same navigation in a drawer built on the
  native `<dialog>` element. `showModal()` supplies the focus trap, Escape-to-close, inert
  background and focus return to the opener without custom code. The drawer closes after a link is
  followed or the route changes.
- Verified in Chromium at 1440×900 (desktop) and 390×844 / Pixel 7 (mobile): no horizontal
  overflow, no console errors, drawer opens/closes with button and Escape.

### 5.5 Design system

**Principles:** a restrained, document-like enterprise look; one accent; no decoration that carries
no information.

**Colour** is defined once as CSS variables in `src/styles/tokens.css` and exposed to Tailwind
through `@theme`. Tailwind's default palette, shadows, radii and fonts are cleared, so an off-system
class (`bg-purple-500`, `shadow-lg`) has no effect.

| Role                  | Tokens (hex)                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| Page / panels         | `ground #efebe2`, `surface #f7f4ee`, `sunken #e6e1d5`, `line #d6cfbf`                |
| Text                  | `ink #1c222b`, `ink-muted #4a5160`, `ink-subtle #565d68`                             |
| Navigation rail       | `nav #171d26` with `nav-text`, `nav-muted`, `nav-dim`                                |
| Accent (forest green) | `accent #2b6a4c`, `accent-hover`, `accent-tint`, `accent-text`                       |
| Status                | muted amber (`warn`), brick (`danger`), stone (`neutral`) — always with a text label |

No pure white or black is used (a test asserts it). **Contrast** is enforced by
`src/styles/tokens.test.ts`, which parses `tokens.css` and fails the build if any pair drops below
WCAG AA: e.g. body text on page 13.4:1, secondary text on panel 7.3:1, tertiary text on the
darkest surface 5.1:1, white-on-accent buttons 5.9:1, planned labels on the rail 5.4:1; form-control
borders and focus rings exceed the 3:1 non-text minimum.

**Typography** — self-hosted from `src/app/fonts/` (no third-party requests at runtime or build):

| Role                  | Typeface       | Licence     | Source                                                                                    |
| --------------------- | -------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Interface text        | IBM Plex Sans  | SIL OFL 1.1 | `@fontsource/ibm-plex-sans` 5.3.0 (https://fontsource.org/fonts/ibm-plex-sans)            |
| Headings, wordmark    | Source Serif 4 | SIL OFL 1.1 | `@fontsource-variable/source-serif-4` 5.3.1 (https://fontsource.org/fonts/source-serif-4) |
| Identifiers, versions | IBM Plex Mono  | SIL OFL 1.1 | `@fontsource/ibm-plex-mono` 5.3.0 (https://fontsource.org/fonts/ibm-plex-mono)            |

Only the Latin subset is bundled. The licence text for each family sits next to its files
(`src/app/fonts/LICENSE-*.txt`). The OFL permits embedding and redistribution with the product;
the fonts must not be sold on their own.

**Icons** are drawn in-house (`components/icons`) on a 24 px grid, 1.5 px stroke, square caps; the
brand mark is an SVG backpack. No icon library is used. PWA icons were generated from the same
geometry.

**Components:** `Button` / `ButtonLink` (primary, secondary, quiet; hover, active, disabled,
loading), `TextField` (label, hint, error, `aria-describedby`, `aria-invalid`), `StatusBadge`,
`EmptyState`, `LoadingState`, `ErrorState`, `Notice`, `Panel`, `DataTable`, `PageTitle`,
`Breadcrumbs`. `EmptyState` is built and tested but has no page to appear on yet (no list
screens exist), so it is not shown in the UI. Corner radii are 2/4/6 px; shadows are not used.

**Accessibility:** skip link, one `h1` per page, landmarks, visible 2 px focus ring on every
interactive element (never removed), `prefers-reduced-motion` honoured, scrollable tables are
keyboard-focusable and named, status never relies on colour alone. Checked by component tests and
Playwright (skip link, landmarks, focus ring, drawer keyboard behaviour). A full manual screen-reader
audit has **not** been performed.

### 5.6 Progressive web app foundations

Present: web app manifest (standalone display, name, theme colours, 192/512 and maskable icons),
Apple touch icon, theme colour. **Not present, deliberately:** a service worker. Caching pages that
will carry private asset and custody data needs the authentication and data-sensitivity design
first; a naive service worker could expose one user's data to the next. Install-to-home-screen
behaviour on real devices has not been tested.

## 6. Security

### Implemented in Phase 1

- No secrets in code; `.env*` ignored by Git, only placeholder `*.example` files tracked.
- Environment validated at start-up; errors never print values.
- API: Helmet headers (`default-src 'none'` CSP for the JSON API, `frame-ancestors 'none'`,
  `nosniff`, `no-referrer`, same-origin resource policy), HSTS in production, CORS allow-list
  (credentials disabled), 1 MiB body limit, input validation, generic 5xx messages in production,
  log redaction, request ids, Swagger off in production by default.
- Web: `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Permissions-Policy` disabling
  camera/microphone/geolocation/payment, HSTS in production, `X-Powered-By` removed, pages marked
  `noindex` (with `robots.txt` disallow), `API_URL` kept server-side.
- Database: TLS required by default in production; query and connection timeouts; restricted-role
  guidance.
- Supply chain: exact dependency versions, committed lockfile, `--frozen-lockfile` in CI.

### Remaining security work (not done)

This system is **not** secure enough for real company data after Phase 1.

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
| Web units/components | Vitest + Testing Library | Design-token contrast, module registry, health client, status views, UI components, navigation, drawer                                    |
| End to end           | Playwright (Chromium)    | Production build + real API + real DB; desktop and mobile projects: pages, live status, responsive nav, keyboard/focus, manifest, headers |

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
| API dev uses `node --env-file-if-exists`             | Reads `.env` without an extra dependency                                                                                                                                                                              |

## 9. Known limitations and open questions

- `EmptyState` and `TextField` (enabled) have no live screen yet; they are covered by tests only.
- The web app shows only Overview; the other nine navigation entries are placeholders by design.
- GPS: only PostGIS is enabled. How positions from phones and from future hardware are ingested
  (and which sources "available GPS sources" means in practice) is to be specified in the
  architecture phase; no capability has been assumed.
- Docker image, Vercel configuration and the CI workflow are written but could not be exercised in
  the Phase 1 build environment (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- The Phase 1 end-to-end tests ran on Chromium only (desktop and mobile emulation). Firefox, Safari
  and physical devices were not tested.
