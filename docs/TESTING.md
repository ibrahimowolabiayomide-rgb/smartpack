# Testing

All commands run from the repository root. In Windows PowerShell they are identical.

| Command                 | What it runs                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm format:check`     | Prettier check across the repository                                                         |
| `pnpm lint`             | ESLint in all packages (includes accessibility rules for the web app)                        |
| `pnpm typecheck`        | TypeScript strict checks in all packages                                                     |
| `pnpm test`             | Unit and component tests: shared (Vitest), API (Jest), web (Vitest + Testing Library)        |
| `pnpm test:integration` | API integration tests against a real PostgreSQL (`TEST_DATABASE_URL`)                        |
| `pnpm build`            | Production build of shared, API and web                                                      |
| `pnpm test:e2e`         | Builds, then runs the quick end-to-end set (1440 and 390 px) against a real API and database |
| `pnpm test:e2e:full`    | Builds, then runs all five viewport widths (1440, 1280, 768, 390, 360)                       |

One-time: `pnpm --filter @smartpack/web exec playwright install chromium`.

## What each layer proves

**Unit and component tests (web)** cover design-token contrast, the module registry (including that
every route has a page), the API client (timeouts, network failure, error envelopes, invalid
bodies, request ids), branding (validation and contrast guard), the sign-in validation and form,
every form field, dialogs, drawers, tabs, menus, toasts, pagination, the shell and the diagnostics
text.

**Integration tests (API)** run the real application against real PostgreSQL: health up, down and
degraded, envelopes, validation, headers, CORS, OpenAPI and production hardening. Phase 2 changed no
API behaviour; only a description string changed.

**End-to-end tests** run in Chromium. Five viewport widths are defined as Playwright projects. The
quick set (`pnpm test:e2e`) runs 1440 px (sidebar layout) and 390 px (drawer layout, Pixel 7
emulation); the full set (`pnpm test:e2e:full`) adds 1280, 768 and 360. Use the full set before
approving a phase and in CI. They start real servers:
1440, 1280, 768, 390 (Pixel 7 emulation) and 360. They start real servers:

| Port | Process                           | Used to test                 |
| ---- | --------------------------------- | ---------------------------- |
| 4100 | API with the test database        | Live status                  |
| 4101 | API whose database is unreachable | "Database unavailable" state |
| 3100 | Web, pointed at 4100              | Everything else              |
| 3101 | Web, pointed at a closed port     | "API unreachable" state      |
| 3102 | Web with `API_URL` unset          | "API address not configured" |
| 3103 | Web, pointed at 4101              | Database failure through web |
| 3104 | Web with `BRAND_*` set            | Configured branding          |

Specs: `routes` (every route renders, no fabricated data, no em dashes, no clipped tables, axe
WCAG 2.2 AA on every route, 404s), `navigation` (sidebar, drawer, breadcrumbs, keyboard, touch
targets), `interactions` (sign-in validation, password visibility, dialogs, menus, tabs, toasts,
manifest, headers), `integration` (live status, refresh, every failure mode), `branding`.

## Phase 1 assertions that changed

Phase 1 tests asserted that nine modules were inert labels (one navigation link, nine disabled
items). Phase 2 deliberately makes them real pages marked "Planned", so those assertions were
replaced with assertions on the new behaviour. The Phase 1 smoke spec was replaced by the specs above.

## Limits

Chromium only. Viewports are emulated; no physical device was used. axe-core finds only part of the
accessibility problems; no manual screen-reader audit was done. Docker, CI and Vercel were not
exercised.

## Local services

Integration and end-to-end tests need PostgreSQL with PostGIS and a dedicated database
(`apps/api/.env.test.local`, see [DATABASE_SETUP.md](DATABASE_SETUP.md)). Free ports 3100 to 3104
and 4100, 4101 before running an end-to-end command.

## Making end-to-end runs faster

- The output is one dot per test; failures are listed in full at the end. Add `--reporter=list` to
  see every test name.
- `pnpm test:e2e` and `pnpm test:e2e:full` rebuild first. If nothing changed since the last build,
  skip the build with `pnpm --filter "@smartpack/web" test:e2e` (or `test:e2e:full`).
- Run one spec or one viewport while working: `pnpm --filter "@smartpack/web" exec playwright test e2e/routes.spec.ts --project=mobile-390`.
- Tests run in parallel using half the CPU cores. More cores means a faster run.
- Measured here (2 cores): quick set 228 passed, 4 skipped in about 4 minutes; full set 572 passed,
  8 skipped in about 8.5 minutes.
