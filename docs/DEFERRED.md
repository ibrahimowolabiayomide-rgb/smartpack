# Deferred and not done

Nothing here is hidden behind a page that looks finished. Each item is either labelled in the
interface as planned or documented here.

## Deferred to named phases

| Item                                                            | Phase (proposed)                       |
| --------------------------------------------------------------- | -------------------------------------- |
| Authentication, accounts, roles, protected routes, real sign-in | 3                                      |
| Settings that can be changed; notifications settings            | 3 (notifications 8)                    |
| SmartPack registration, QR identity, asset tables               | 4                                      |
| Workers, assignments, custody ledger and handovers              | 5                                      |
| QR scanning, photographic verification, inspections             | 6                                      |
| GPS sources, location history, tracking map                     | 7                                      |
| Alerts, incidents, unauthorised-use detection                   | 8                                      |
| Reports, exports, integrations, data management                 | 9 and 10                               |
| Offline support and a service worker                            | after authentication design            |
| GPS hardware integration                                        | to be specified; no capability assumed |

The phase numbers are a proposal and need owner approval.

## Built but not yet used

- `ConfirmDialog`: tested, but no destructive action exists.
- `EmptyState`: tested, but no module works yet, so no list can be legitimately empty.
- `DateField`: tested, used by planned filter bars only (disabled).

## Not built on purpose

- A tooltip component. Nothing needed one.
- A dark theme. The brief asked for a warm light interface; a second theme doubles contrast checking.
- Real privacy policy and terms of service text. These are the company's to supply.

## Not verified

- Behaviour in Safari, Firefox and on physical phones and tablets (Chromium viewport emulation only).
- A manual screen-reader audit. axe-core ran on every route; it finds only part of the problems.
- Docker image build, GitHub Actions workflow, Vercel deployment and the production host (no
  accounts or network access in the build environment).
- Installation on Windows PowerShell by the build environment itself (it ran on Linux); the commands
  in the Phase 2 report are the Windows equivalents.

## Known trade-offs

- All pages are rendered per request because branding is read at request time.
- The health endpoint is public and the Overview page shows its version and environment name.
  Splitting a minimal public check from a detailed authenticated one belongs with authentication.
