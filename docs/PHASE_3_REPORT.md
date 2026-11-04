# Phase 3 report: backend foundation, authentication and access control

Baseline: the Phase 2 archive. Phase 3 added the database foundation, real authentication,
company, member and role management, an audit log, and the web screens for them. Nothing from
Phase 4 onward was started: there are no SmartPack, worker, custody, verification, tracking,
inspection or alert features.

Everything below was run in the build environment: **Linux**, Node 22.23.4, pnpm 10.28.0,
PostgreSQL 16 with PostGIS 3.4, Chromium. **The build environment never ran Windows**; the owner's own Windows run is reported below. Git was not used: nothing
was staged, committed or pushed, and no archive was deleted.

## The 413 test (`read ECONNRESET`)

The Phase 2 baseline was verified first (below). The oversized-body test was then investigated, not
changed to pass.

- **Cause.** For a request whose `Content-Length` exceeds the limit, Fastify answers 413 with
  `Connection: close`, and Node destroys the socket while the client is still sending. Closing a
  TCP connection that has unread incoming data makes the operating system send a reset, and a reset
  can overtake the 413 on the way to the client, which then reports `ECONNRESET` or `EPIPE`. Whether
  it does depends on timing and platform; Windows is reported to discard a response that arrived just
  before a reset (I could not test that here).
- **Reproduction.** The failure **could not be reproduced on Linux** (the 413 always arrived). The
  explanation above is therefore a well-understood mechanism, **not a confirmed diagnosis of your
  failure**.
- **Fix.** `apps/api/src/common/body-limit.ts` adds an `onRequest` guard that answers 413 in the
  standard error envelope **without** `Connection: close` when the declared length is over the limit,
  so Node reads and discards the rest (bounded to 16 MiB; beyond that the connection is closed on
  purpose) and the client always finishes its upload and reads the response. Chunked bodies without a
  length still use Fastify's own limit.
- **The test was kept, not weakened.** `apps/api/test/body-limit.integration.spec.ts` now has four
  tests: a slow client reads a complete 413 while still uploading, the connection stays usable after
  the rejection, a huge declared body is refused with the connection closed, and a body just under
  the limit is accepted. They pass on Linux.
- **Confirmed on Windows.** On the owner's Windows machine `pnpm test:integration` passed 105 of
  105, including all four `body-limit` tests. The earlier failure is fixed there.

Another baseline difference to be open about: you reported 275 unit tests for Phase 2. The Phase 2
archive measured 258 here (shared 10, API 64, web 184). I could not account for the 17 difference.

## Windows run by the owner

The owner ran the first Phase 3 archive on Windows (Node 22, pnpm 10.28.0, 2 Playwright workers):

| Check                               | Result                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| `pnpm test:integration`             | 105 passed, 7 suites, including `body-limit`                          |
| `format:check`, `lint`, `typecheck` | Passed                                                                |
| `pnpm test`                         | 20 / 114 / 214 passed (same counts as on Linux)                       |
| `pnpm build`                        | Passed                                                                |
| `pnpm test:e2e` (quick set)         | 340 passed, 5 skipped, **3 failed** (all at 1440 px, `auth-journeys`) |

The 3 failures: two sign-in tests whose redirect did not complete within the 5 second assertion
limit, and the longest journey (invite, join, suspend, reactivate) that hit the 30 second test
limit. Every other sign-in and journey passed, including all of them at 390 px.

**Cause (established for the long journey, likely for the other two).** The Linux runs used one
worker on a machine where that journey takes about 18 seconds. Running the same file on the same
Linux machine with its CPU loaded (about two to three times slower) reproduced the long-journey
timeout (32.2 s against 30 s). The two sign-in tests did **not** fail under that load here, so
their timeout is the likely, not proven, same cause: the first sign-ins of the run, with two
workers starting at once on a slower machine. The owner's run shows no functional defect (no
error message, the page was still submitting).

**Change.** `playwright.config.ts` now allows 60 seconds per test and 15 seconds per assertion, and
the longest journey is marked `test.slow()`. No assertion was altered, removed or skipped. With the
change, the same file passed 25 of 25 under the same CPU load. These limits only decide how long
a test waits; a real failure still fails, only later.

**To confirm.** Please re-run `pnpm test:e2e` on Windows with this archive. If any test still
fails, send the same failure output plus its `error-context.md`.

## Completed and verified

Final run on the finished code (counts are real output; see the table below).

- **Database**: PostgreSQL migrations (3), tables for companies, users, memberships, roles,
  permissions, sessions, invitations, one-time tokens, email deliveries and the audit log;
  constraints, indexes, reference data for 7 roles and 25 permissions
  ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)).
- **Authentication**: sign-in, sign-out, sign out everywhere, current user, forgot, reset and change
  password, email verification and resend, list and revoke sessions, revoke all others. Argon2id
  hashing; opaque 32-byte session tokens stored only as SHA-256 hashes; HttpOnly, SameSite=Lax
  cookie (`__Host-` prefix and Secure in production); idle and absolute expiry; a single generic
  message for every sign-in failure ([AUTHENTICATION.md](AUTHENTICATION.md)).
- **Access control**: deny by default (an endpoint without a decision is closed), permission checks
  on the server, company isolation (another company's records answer 404), last-Owner protection,
  nobody can assign a role holding permissions they lack ([ACCESS_CONTROL.md](ACCESS_CONTROL.md)).
- **Company, members, invitations, roles, permissions, audit endpoints** under `/api/v1`
  ([API_REFERENCE.md](API_REFERENCE.md)), validated on the server with Zod, documented in Swagger.
- **First-owner bootstrap**: a command-line tool only (no HTTP route, no default password, refuses
  to run twice, safe under concurrent runs), with a `system.bootstrap` audit event
  ([BOOTSTRAP.md](BOOTSTRAP.md)).
- **Rate limiting** on sign-in, reset, invitation and verification endpoints
  ([RATE_LIMITING.md](RATE_LIMITING.md)).
- **Audit log**: append-only (database triggers refuse UPDATE, DELETE, TRUNCATE), written in the
  same transaction as the change, secret-free by construction
  ([AUDIT_LOGGING.md](AUDIT_LOGGING.md)).
- **Email abstraction** with `none`, `dev-capture` and `smtp` providers; no paid provider chosen
  ([EMAIL.md](EMAIL.md)).
- **Web application**: real sign-in with return to the requested page, protected routes (cookie
  check in `proxy.ts`, authoritative session check in the app layout), same-origin API gateway,
  current-user context, company settings, members, invitations, roles and permissions, audit log,
  account and security page, forgot/reset password, accept invitation, verify email; loading, empty,
  error and success states; Phase 2 design system preserved.
- **Fix to the Phase 2 command line**: `pnpm bootstrap -- --flags` failed because pnpm passes a
  literal `--`; the parser now accepts it.
- **Database outage** now answers 503 `SERVICE_UNAVAILABLE` (it was a generic 500).
- **Backup and restore** rehearsed on a scratch database ([BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md)).
- **Performance baseline** from real measurements ([PERFORMANCE.md](PERFORMANCE.md)).

## Test results (Revision 2; Revision 3 results are above)

| Check                                                    | Result                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm format:check`                                      | Passed                                                                    |
| `pnpm lint`                                              | Passed                                                                    |
| `pnpm typecheck`                                         | Passed                                                                    |
| `pnpm test` (shared / API / web)                         | 20 / 114 / 214 tests passed (348)                                         |
| `pnpm test:integration`                                  | 105 passed against real PostgreSQL (7 suites)                             |
| `pnpm build`                                             | Passed                                                                    |
| `pnpm test:e2e:full` (Chromium, five widths)             | 858 passed, 12 skipped, 0 failed (870 tests, about 17 minutes on 2 cores) |
| `pnpm test:e2e` (quick set) after the time-budget change | 343 passed, 5 skipped, 0 failed (348 tests, about 6 minutes, Linux)       |

The full-set result above was measured before the time-budget change described under "Windows run by the owner"; the change affects waiting times only, and the full set was not re-run afterwards (the quick set was).

The 12 skipped end-to-end tests are intentional: the four drawer and touch-target tests at 1440
and 1280 px (8, where the sidebar is permanent), and the company-profile edit journey on the four
projects other than 1440 px (4, because all projects share one database and the journey changes the
company record, so it runs once).

**A failure was found and fixed on the way.** The first full run had 857 passed and 1 failed: at
360 px the audit log table was 16 px wider than its container, because a long event code such as
`auth.sessions.revoked_others` could not wrap. It only appeared once earlier journeys had created
such events, which is why the earlier, shorter runs of that page passed. The code now wraps
(`audit-viewer.tsx`), and the full suite was run again from the start on the rebuilt application:
the result in the table is that second run. No test was changed or skipped to obtain it.

## Implemented but not fully verified

- **Windows end-to-end.** The unit, integration (including the 413 fix) and build checks passed on the owner's Windows machine. The quick browser set had three timing failures there; the fix has only been verified on Linux and needs a Windows re-run.
- **Real email delivery.** SMTP was tested against a local test server (`smtp-server`), not a real
  provider. Real providers differ in TLS, authentication and limits.
- **Several API instances.** Rate limits are held per process, so with more than one instance each
  keeps its own counters.
- **Proxy settings on a real host.** `TRUST_PROXY_HOPS` was reasoned about and unit-tested, not tried
  behind Vercel or a real load balancer.
- **Production deployment**: Vercel, the container image, GitHub Actions and a hosted database were
  not exercised (no accounts or network access).
- **Browsers and devices.** Chromium with emulated viewports only. No Safari, Firefox or physical
  phone. axe-core ran on every route and on the new pages in their working states; no manual
  screen-reader audit.
- **Security.** Checks are automated tests written by the same team. They are not a penetration
  test; an independent review is recommended before real company data is stored.
- **Performance** is one run on a shared two-core machine ([PERFORMANCE.md](PERFORMANCE.md)); not a
  capacity claim.
- **Backup and restore** on a hosted provider and point-in-time recovery.

## Not implemented (deliberate)

- Business modules (Phases 4 onward).
- Multi-factor authentication, single sign-on, custom roles, per-person permissions.
- Enforcing a verified email address before use (verification exists and is displayed).
- A "your password was changed" email.
- Audit retention and purge.
- A guided "transfer ownership" flow (an Owner can add another Owner).
- Company-wide sign-out for an administrator (suspending a member ends their sessions).

## Revision 3 (corrections after the owner's comparison)

After comparing Revision 2 with the existing project, the owner approved the authentication changes
and asked for regressions to be corrected. Nothing in the authentication model, permissions or
security checks was changed.

| Request                           | What was done                                                                                                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Branding on Company Settings   | New `features/settings/branding-details.tsx`, fed by the real `getBrandConfig()`: company name (or "Not configured"), "Custom logo in use" or the default mark, accent colour, and a warning naming each ignored `BRAND_*` variable (never its value) |
| 2. Branding end-to-end assertions | `e2e/branding.spec.ts` asserts again the company name, "Custom logo in use" and `#1d4f91`, plus the defaults; a sixth web server (port 3105) proves the warning for invalid values                                                                    |
| 3. Application preferences        | Not built and no placeholder. Recorded in [DEFERRED.md](DEFERRED.md) with what remains                                                                                                                                                                |
| 4. Settings loading               | `settings/loading.tsx` shows a "Loading settings" status inside the layout; the sub-navigation stays visible. Unit test and an end-to-end test that holds the request                                                                                 |
| 5. Stale docs and comments        | `PreviewBanner` removed from `COMPONENTS.md`; `PROJECT_ARCHITECTURE.md` no longer says routes are unprotected or sign-in is inert; comments in `robots.ts` and `layout.tsx` corrected, behaviour unchanged (`noindex`, robots `disallow: /`)          |
| 6. ESLint                         | The Revision 2 override (six rules off for every file under `test/`) is gone. The harness has one typed `JsonBody` alias with one documented disable. Three integration files keep one rule, `no-unsafe-member-access`, off (see below)               |
| 7. Settings navigation            | Three Phase 2 anchors are forwarded to the new routes, four still work, one has no destination. Documented in [ROUTES_AND_MODULES.md](ROUTES_AND_MODULES.md)                                                                                          |
| 8. Four old files                 | Not restored; see the confirmation table below                                                                                                                                                                                                        |

**Fix after the owner's Windows run of Revision 3.** The quick end-to-end set had two failures
(1440 and 390 px) in my new anchor test: `#data-management` was not scrolled into view. This was a
real defect, not a Windows quirk. Settings now streams in behind its loading state, so the browser's
own jump to a fragment can happen before the target exists and is not repeated. It passed on the
faster Linux machine by timing, and failed there too once the CPU was loaded. `LegacyAnchorRedirect`
now also scrolls to the named element when the page arrives (only for fragments that are not
forwarded), with unit tests, and the end-to-end test also covers `#company-profile`.

**The owner's Windows run of Revision 3** passed format, lint, typecheck, unit (20 / 114 / 227),
integration (105) and build, and the quick end-to-end set had 353 passed, 5 skipped and the two
failures above. His script printed "ALL PHASE 3 R3 VALIDATION CHECKS PASSED" after that failure
because the `throw` did not stop the script; the run did not pass.

A later Linux run of the corrected build had one different failure, in my loading-state test at
390 px: the click happened before the browser had finished prefetching the Audit page's loading
boundary, so no loading state showed. I could not reproduce it in 36 repeated runs, with and without
CPU load, so the cause is inferred from what the failure left behind, not proven. The test now waits
until all prefetch traffic for that page has finished and been quiet for a second before it clicks.
No assertion was weakened. After that change it passed 30 of 30 repeated runs under CPU load and the
full quick set passed.

**ESLint exemption that remains.** `access`, `auth` and `security` integration specs read JSON
bodies that the tests deliberately do not model with a type per endpoint, so
`@typescript-eslint/no-unsafe-member-access` is off for those three files only. `no-explicit-any`
and the other `no-unsafe-*` rules are on everywhere. The reason is written next to the override in
`apps/api/eslint.config.mjs`. The other sites that needed it were given real types or narrowed casts
instead of an exemption.

**The four Phase 1 files.** Each is already covered by something that is in Phase 2 and Phase 3 alike:

| Old file                         | Where the behaviour lives now                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/api-health.ts` and its test | `lib/api/health.ts` and `health.test.ts` (timeouts, network failure, error envelopes, invalid bodies), the platform-status feature and its component tests, and the live status end-to-end tests |
| `dashboard/error.tsx`            | `(app)/error.tsx`, which covers every signed-in page; new `app-error.test.tsx` proves the message and that "Try again" calls `reset`                                                             |
| `dashboard/loading.tsx`          | A Suspense fallback around the status panel on the Overview page, and the new `settings/loading.tsx` for Settings                                                                                |

**Results of Revision 3** (Linux, this build environment):

| Check                                             | Result                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm format:check`, `lint`, `typecheck`, `build` | All passed                                                                                          |
| `pnpm test` (shared / API / web)                  | 20 / 114 / 229 passed (363)                                                                         |
| `pnpm test:integration`                           | 105 passed, 7 suites                                                                                |
| `pnpm test:e2e` (quick set)                       | 355 passed, 5 skipped, 0 failed (360 tests, 7.3 minutes). The same five intentional skips as before |

The full five-width end-to-end set and Windows were **not** re-run for Revision 3. The new Settings
tests ran at 1440 and 390 px only.

## Deferred

See [DEFERRED.md](DEFERRED.md). Notable items: shared rate-limit store, retention policy, a
public/detailed split of the health endpoint, data-protection decisions (account deletion and
export).

## Blocked

Nothing is blocked. Items that need your accounts or decisions are listed under "Decisions needing
owner approval" and "Costs".

## Behaviour changes to know about

1. **Phase 2 Overview status checks** for "API unreachable", "database unavailable" and "API address
   not configured" assumed `/dashboard` was open to anyone. It now needs a session, so those three
   end-to-end checks were replaced by session-layer equivalents (an unknown session cookie sent to
   each broken environment must give the right error page and never a signed-in view). The panel
   itself is still covered by unit and integration tests. This is a changed test, not a hidden one.
2. **`BRAND_COMPANY_NAME`** is not shown in the signed-in sidebar, which shows the company's real
   name from the database. The web branding (name, logo, accent colour and any ignored `BRAND_*`
   values) is shown on Company Settings, and the public pages stay branded.
3. **Failed sign-ins for an address with no account** are stored in the audit table but belong to no
   company, so they appear in no company's audit view.
4. **Rate-limited requests** are not audited (the failures before the block are), and while blocked
   even the correct password is refused.
5. The end-to-end suite runs with rate limiting **off** (`RATE_LIMIT_DISABLED=true`, refused in
   production); limits are tested in the integration suite.
6. **Email verification is displayed, not enforced.**

## Decisions needing owner approval

1. Seven fixed roles and 25 permissions ([ACCESS_CONTROL.md](ACCESS_CONTROL.md)): are these the right
   roles for the company?
2. Opaque server-side sessions in the database instead of JWTs (immediate revocation, at the price
   of one query per request).
3. Session lifetimes: 8 hours idle, 7 days absolute.
4. Sign-in rate limits and their messages ([RATE_LIMITING.md](RATE_LIMITING.md)).
5. No public registration; the first Owner is created from the command line.
6. Email: whether and when to adopt a provider, and when to enforce verification.
7. Audit retention period.
8. Same-origin web gateway for browser calls (`/api/v1/*`).
9. New dependencies (all free and open source): `@node-rs/argon2` 2.2.2, `@fastify/cookie` 11.1.5,
   `nodemailer` 10.3.1, and for tests only `smtp-server` 3.21.3 with its types.

## Costs

| Item                         | Cost implication                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| New dependencies             | None; free and open source                                                                                                      |
| Accounts created for you     | **None.** No service was signed up for, enabled or deployed                                                                     |
| Email delivery               | `none` and `dev-capture` are free. Real delivery needs an SMTP provider; prices and free allowances vary and are yours to check |
| Hosting (web, API, database) | Not purchased. Vercel, an API host and PostgreSQL with PostGIS may charge depending on the plan you choose                      |
| Backups                      | `pg_dump` is free; hosted-database backup retention and point-in-time recovery may be plan-dependent                            |
| Rate limiting                | In-process; no Redis or other service                                                                                           |
| Maps, storage, monitoring    | None used                                                                                                                       |

No recurring or usage-based charge was introduced by Phase 3.

## Known limitations

See [DEFERRED.md](DEFERRED.md) for the full list. In short: Linux-only verification, Chromium-only
end-to-end tests, per-process rate limits, verification not enforced, no audit retention, no
penetration test.

## Windows PowerShell

```powershell
# From the extracted project folder
corepack enable
pnpm install --frozen-lockfile

Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\api\.env.test.example apps\api\.env.test.local
Copy-Item apps\web\.env.example apps\web\.env.local
# Edit DATABASE_URL and TEST_DATABASE_URL (docs\DATABASE_SETUP.md). Keep WEB_APP_URL and
# EMAIL_PROVIDER=dev-capture for local use.

pnpm db:migrate

# Create the first company and Owner (you are prompted for the password; it is not echoed)
pnpm --filter @smartpack/shared build
pnpm --filter @smartpack/api build
pnpm --filter @smartpack/api bootstrap `
  --organization-name "Your Company Ltd" `
  --owner-email you@your-company.example `
  --owner-first-name Ada --owner-last-name Okafor `
  --time-zone Africa/Lagos --country NG

pnpm dev        # web http://localhost:3000/login, API http://localhost:4000/api/docs

# Verification
pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; pnpm test:integration; pnpm build
pnpm --filter "@smartpack/web" exec playwright install chromium   # once
pnpm test:e2e         # quick: 1440 and 390 px
pnpm test:e2e:full    # all five widths, 15 to 20 minutes on a small machine
```

Please re-run `pnpm test:e2e` on Windows and send the result. If a test still fails, send the full
failure output and its `error-context.md` (neither contains secrets).

## Git

Nothing was staged, committed or pushed, and no archive was deleted. The Phase 2 archive is
untouched.

## Stop

Phase 3 is complete pending your review. Phase 4 has not been started and will not be until you
approve this phase.
