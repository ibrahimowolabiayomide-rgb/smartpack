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

**Unit and component tests** (`pnpm test`) were 361 tests in the final run: shared 20 (Vitest), API
114 (Jest, 8 suites) and web 227 (Vitest and Testing Library, 22 files). They cover design-token
contrast, the module registry, the API clients (timeouts, network failure, error envelopes, invalid
bodies, request ids), branding, sign-in validation and the forms, password rules, URL-fragment
tokens, the session cookie helpers, every form field, dialogs, menus and tables, and on the API
side: configuration rules (including every production restriction), error mapping (including
database-unavailable to 503), the security primitives (token generation and hashing, password
policy, rate-limit arithmetic, metadata guard), email templates and the command-line argument
parser.

**Integration tests** (`pnpm test:integration`) were 105 tests in 7 suites, run against a real
PostgreSQL with PostGIS (`TEST_DATABASE_URL`):

| Suite              | What it proves                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`             | Sign-in, sign-out, session expiry and revocation, password change and reset, email verification, and the audit trail each leaves; CSRF origin checks and cookie handling              |
| `access`           | Deny-by-default and every role against the protected endpoints, separation between companies, last-Owner protection, suspension and removal, invitations, company profile, audit log  |
| `security`         | Route protection (every route is public on purpose or protected), rate limits, production configuration refusals, SMTP delivery against a local test server                           |
| `database`         | Constraints, migrations on a clean database, first-owner bootstrap (including concurrent runs), audit immutability (UPDATE, DELETE and TRUNCATE refused), slug generation             |
| `http-conventions` | Envelopes, validation, request ids, security headers, CORS, OpenAPI, production hardening                                                                                             |
| `body-limit`       | Oversized bodies answer 413 with the standard envelope, including while the client is still uploading; the connection stays usable or ends cleanly; a body just under the limit works |
| `health`           | Health up, database down (503), PostGIS missing (degraded), error envelope                                                                                                            |

**End-to-end tests** run in Chromium against production builds, a real API and a real database.
Their launcher (`apps/web/e2e/serve-api.mjs`) drops and recreates a throwaway `smartpack_e2e`
database, applies the migrations and creates a test Owner through the real bootstrap code, so a run
never touches development data. Five viewport widths are Playwright projects: the quick set
(`pnpm test:e2e`) runs 1440 px (sidebar layout) and 390 px (drawer layout, Pixel 7 emulation); the
full set (`pnpm test:e2e:full`) adds 1280, 768 and 360. Use the full set before approving a phase
and in CI.

| Port | Process                           | Used to test                              |
| ---- | --------------------------------- | ----------------------------------------- |
| 4100 | API with the throwaway database   | Everything that needs a working API       |
| 4101 | API whose database is unreachable | Session checks while the database is down |
| 3100 | Web, pointed at 4100              | Everything else                           |
| 3101 | Web, pointed at a closed port     | "Service unreachable" states              |
| 3102 | Web with `API_URL` unset          | "API address not configured"              |
| 3103 | Web, pointed at 4101              | Database failure seen through the web     |
| 3104 | Web with `BRAND_*` set            | Configured branding                       |
| 3105 | Web with invalid `BRAND_*` values | The ignored-values warning on Settings    |

Specs:

- `routes`: every route renders at every width, no fabricated data, no em dashes, no clipped tables
  or horizontal page scroll, axe WCAG 2.2 AA on every route, 404s.
- `navigation`: sidebar, drawer, breadcrumbs, keyboard, touch targets, settings sub-navigation.
- `interactions`: sign-in validation, password visibility, dialogs, menus, tabs, toasts, manifest,
  headers.
- `integration`: signed-in behaviour against the live API and every failure mode (service
  unreachable, database down, API address not configured).
- `branding`: configured branding on Company Settings (name, "Custom logo in use", accent `#1d4f91`),
  the unconfigured defaults, the warning for invalid values, and the contrast guard.
- `settings-loading`: the route-level loading state of the Settings pages, and the forwarding of
  the old Phase 2 Settings anchors.
- `auth-journeys`: sign-in and sign-out, protected-route redirects, invitation to first sign-in,
  password reset, password change, session revocation, company settings, member management and
  the audit log, driven through the real interface.

### Time budgets

Each test may take 60 seconds and each assertion waits up to 15 seconds (`playwright.config.ts`);
the longest journey (invitation, join, suspension) is marked `test.slow()`. The defaults (30 s and
5 s) timed out on a Windows machine that was about two to three times slower than the Linux
machine the suite was written on, and the same timeout was reproduced on Linux under CPU load.
The limits only decide how long a test waits; no assertion depends on them.

### How end-to-end sign-in works

A global setup signs the test Owner in once and stores the session in `e2e/.auth/owner.json`
(ignored by Git and Prettier). Specs that need a signed-in person reuse it; specs about signed-out
behaviour start with no state. Cookies are host-scoped, so the saved session works on every port.
Rate limiting is switched off for these runs (`RATE_LIMIT_DISABLED=true`, refused in production)
because the suite signs in far more often than a person would; limits are covered by the
integration tests instead.

**All projects share one database.** Specs must not assume an empty company or count rows;
specs that change shared data (for example the Owner's own profile) run on the 1440 px project
only. Members beyond the first page are found with `?search=`.

## Phase 2 assertions that changed in Phase 3

The Phase 2 Overview status checks for "API unreachable", "database unavailable" and "API address
not configured" assumed anyone could open `/dashboard`. Now the dashboard needs a session, so
those three checks were rewritten to prove the equivalent at the session layer: a request with a
syntactically valid but unknown session cookie, sent to each broken environment, must produce the
right error page and never a signed-in view. The original health-panel behaviour is still covered
by unit tests of the panel and by integration tests of `/health`. The sign-in tests that said
"sign-in is not enabled" were replaced by tests of real sign-in.

## Phase 1 assertions that changed

Phase 1 tests asserted that nine modules were inert labels (one navigation link, nine disabled
items). Phase 2 deliberately makes them real pages marked "Planned", so those assertions were
replaced with assertions on the new behaviour. The Phase 1 smoke spec was replaced by the specs above.

## Limits

Chromium only. Viewports are emulated; no physical device was used. axe-core finds only part of the
accessibility problems; no manual screen-reader audit was done. Docker, CI and Vercel were not
exercised. Most runs were on Linux. The owner also ran the unit, integration, build and quick end-to-end sets on Windows (see [PHASE_3_REPORT.md](PHASE_3_REPORT.md)). Rate limits are only covered by
integration tests (disabled in end-to-end runs). SMTP was tested against a local test server only.
These tests were written by the same team that wrote the code, so they are not a substitute for an
independent security review.

## Local services

Integration and end-to-end tests need PostgreSQL with PostGIS and a dedicated database
(`apps/api/.env.test.local`, see [DATABASE_SETUP.md](DATABASE_SETUP.md)). Free ports 3100 to 3105
and 4100, 4101 before running an end-to-end command. The end-to-end launcher also needs a role that
may create and drop databases (the same one the integration tests use).

## Load and latency

`apps/api/perf/baseline.mjs` measures request latency against a running API; it is not part of the
test commands. Method, results and limits are in [PERFORMANCE.md](PERFORMANCE.md).

## Making end-to-end runs faster

- The output is one dot per test; failures are listed in full at the end. Add `--reporter=list` to
  see every test name.
- `pnpm test:e2e` and `pnpm test:e2e:full` rebuild first. If nothing changed since the last build,
  skip the build with `pnpm --filter "@smartpack/web" test:e2e` (or `test:e2e:full`).
- Run one spec or one viewport while working: `pnpm --filter "@smartpack/web" exec playwright test e2e/routes.spec.ts --project=mobile-390`.
- Tests run in parallel using half the CPU cores. More cores means a faster run.
- Measured here (2 cores, one worker): full set 858 passed, 12 skipped in about 17 minutes. Earlier
  measurements: Phase 2 quick set about 4 minutes, full set about 8.5 minutes (fewer tests, and a
  different machine load). Phase 3 adds a database rebuild at start and many sign-in journeys.
