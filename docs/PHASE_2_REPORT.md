# Phase 2 report: application shell and frontend-backend integration

Baseline: `smartpack-phase-1-review-r2.zip`. Phase 2 changed the web application, its tests and the
documentation. The API and database are unchanged apart from one description string in the Swagger
text (no longer says "Phase 1").

## Completed and verified

Each item was run in the build environment (Linux, Node 22.23.4, pnpm 10.28, PostgreSQL 16 with
PostGIS, Chromium). Results are in the table below.

- Design system: tokens, fonts, in-house icons, status language, contrast test.
- Responsive application shell: sidebar, mobile drawer, top bar, Help menu, preview banner,
  breadcrumbs, Main and Secondary navigation.
- All routes: landing, sign-in, privacy, terms, Overview, nine module pages, Help, not-found.
- Reusable components: buttons, text, password, select, search and date fields, filter bar, tables,
  mobile cards, pagination, tabs, dialogs, drawers, dropdown menus, toasts, status and state
  components (see [COMPONENTS.md](COMPONENTS.md)).
- Real frontend to backend integration: server-side API client with timeout, request ids, response
  validation and five explicit failure states; live health shown as system status only.
- Optional company branding from server environment variables, with validation and a contrast guard.
- Sign-in form with client-side validation and an honest "not enabled" result.
- Planned modules clearly labelled; no fabricated records, names, numbers or statistics.
- Documentation updated and extended.

## Test results

| Check                                        | Result                                                              |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`             | Passed                                                              |
| `pnpm format:check`                          | Passed                                                              |
| `pnpm lint`                                  | Passed                                                              |
| `pnpm typecheck`                             | Passed                                                              |
| `pnpm test` (shared / API / web)             | 10 / 64 / 184 tests passed                                          |
| `pnpm test:integration`                      | 31 passed against real PostgreSQL                                   |
| `pnpm build`                                 | Passed (all pages render on demand; icons, manifest, robots static) |
| `pnpm test:e2e:full` (Chromium, five widths) | 572 passed, 8 skipped, 0 failed                                     |
| `pnpm test:e2e` (quick: 1440 and 390 px)     | 228 passed, 4 skipped, 0 failed                                     |

The 8 skipped e2e tests are the drawer and touch-target tests (4 tests) at 1440 and 1280 px, where
the sidebar is permanent and there is no drawer or touch input to test. Playwright and axe-core ran against the production build with a real API and database,
including API unreachable, API address not configured and database down.

## Completed but not fully verified

- Accessibility: axe-core WCAG 2.2 AA passed on every route; no manual screen-reader or
  keyboard-only audit was done by a person.
- Responsive layouts: checked in Chromium at 1440, 1280, 768, 390 and 360 px and by viewing
  screenshots; not on physical devices, Safari or Firefox.

## Not completed

- Authentication and everything that needs it (Phase 3).
- Every business module (Phases 4 to 9).

## Deferred

See [DEFERRED.md](DEFERRED.md).

## Decisions needing owner approval

1. **Sign-in behaviour**: the form validates input and says sign-in is not enabled; nothing is sent
   or stored.
2. **Company branding through `BRAND_*` server variables**, including the accent colour override.
   Consequence: every page renders per request.
3. **New dependencies**: `zod` (now a direct web dependency, same version as shared) and
   `@axe-core/playwright` (dev only).
4. **"Planned" tags** in navigation and a real page for every planned module, instead of Phase 1's
   inert labels.
5. **Module-to-phase mapping** ([ROUTES_AND_MODULES.md](ROUTES_AND_MODULES.md)).
6. **Help menu contents** (Help & Documentation, Diagnostics, Privacy, Terms).
7. **Dashboard and Settings remain open** until Phase 3; a banner says so.
8. **Privacy and terms pages are placeholders**; the company must supply the text.
9. **Replaced Phase 1 tests**: assertions that planned modules are inert were replaced because the
   behaviour was deliberately changed.
10. **`dashboard/loading.tsx` removed** in favour of a Suspense boundary around the status panel.

## Known limitations

- Chromium only; emulated viewports.
- Docker image, GitHub Actions workflow and Vercel deployment were not exercised.
- The health endpoint is public and shows version and environment name.

## Windows PowerShell

```powershell
corepack enable
pnpm install
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\api\.env.test.example apps\api\.env.test.local
Copy-Item apps\web\.env.example apps\web\.env.local
# edit DATABASE_URL and TEST_DATABASE_URL (see docs/DATABASE_SETUP.md), then:
pnpm db:migrate
pnpm dev                       # web http://localhost:3000, API http://localhost:4000/api/v1/health

pnpm format:check; pnpm lint; pnpm typecheck; pnpm test; pnpm test:integration; pnpm build
pnpm --filter "@smartpack/web" exec playwright install chromium   # once
pnpm test:e2e          # quick, about 4 minutes
pnpm test:e2e:full     # all five widths, about 9 minutes
```

## Git

The work is committed to a local repository with history preserved from the Phase 1 baseline. No
remote is configured and nothing was pushed.
