# Deferred and not done

Nothing here is hidden behind a page that looks finished. Each item is either labelled in the
interface as planned or documented here.

## Deferred to named phases

| Item                                                | Phase (proposed)                       |
| --------------------------------------------------- | -------------------------------------- |
| Notification preferences                            | 8                                      |
| SmartPack registration, QR identity, asset tables   | 4                                      |
| Workers, assignments, custody ledger and handovers  | 5                                      |
| QR scanning, photographic verification, inspections | 6                                      |
| GPS sources, location history, tracking map         | 7                                      |
| Alerts, incidents, unauthorised-use detection       | 8                                      |
| Reports, exports, integrations, data management     | 9 and 10                               |
| Offline support and a service worker                | after authentication design            |
| GPS hardware integration                            | to be specified; no capability assumed |

The phase numbers are a proposal and need owner approval. Authentication, accounts, roles,
protected routes, real sign-in and company settings were delivered in Phase 3.

## Phase 3: decisions and features left for the owner

These are deliberate omissions in the access foundation. None is hidden: where a person could expect
the feature, the interface or the documentation says it is not there.

| Item                                           | Why it is not in Phase 3                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Multi-factor authentication, single sign-on    | Product decisions with cost and support implications (an authenticator app is free; SMS and SSO are not)             |
| Custom roles and per-person permissions        | Seven fixed roles cover the planned modules; a role editor needs a design decision on who may create powerful roles  |
| Requiring a verified email address             | Verification is shown but not enforced. Enforcement should wait until an email provider is in use                    |
| A "your password was changed" email            | The template exists but is not sent; it needs the email provider decision                                            |
| A shared rate-limit store                      | Limits are per process. A shared store (and its cost) is a decision for when the API is scaled out                   |
| Audit retention, archive and purge             | Needs a retention period from the company; the table is append-only by design ([AUDIT_LOGGING.md](AUDIT_LOGGING.md)) |
| Transferring ownership as a guided flow        | An Owner can make another person an Owner and then change or remove themselves; there is no one-click "transfer"     |
| Company-wide "sign out everyone" for an admin  | A person can end their own sessions; ending a member's sessions is done by suspending them                           |
| Worker sign-in experience                      | The `worker` role exists and can sign in, but it holds no data permissions until Phase 5                             |
| Account deletion and data export for a person  | Needs a data-protection and retention decision                                                                       |
| Creating a second company from the application | By design only the bootstrap command creates a company. Multi-company operation is not a Phase 3 goal                |

## Application preferences (Settings)

Phase 2 listed "Application preferences" as a planned Settings section. Phase 3 does not build it and
does not show a placeholder: there is no section, no control and no stored value, and the old
`#application-preferences` link opens Settings without a destination.

It is not built because no preference has been specified, and none may be invented. What remains:

1. The owner decides which per-person preferences are wanted (for example date and time format,
   default page, table density). Time zone is already a per-person setting under Security.
2. Storage: a column or table on the user or the membership, with a migration.
3. API endpoints to read and update it, with server-side validation and a decision on whether changes
   are audited.
4. The Settings section and its states (loading, saved, error).
5. Unit, integration and end-to-end tests, and an update to this file.

## Built but not yet used

- `DateField`: tested, used by planned filter bars only (disabled).

## Not built on purpose

- A tooltip component. Nothing needed one.
- A dark theme. The brief asked for a warm light interface; a second theme doubles contrast checking.
- Real privacy policy and terms of service text. These are the company's to supply.
- Public registration. SmartPack is a company platform; people join by invitation.

## Not verified

- Behaviour in Safari, Firefox and on physical phones and tablets (Chromium viewport emulation only).
- A manual screen-reader audit. axe-core ran on every route and on the new pages in their working
  states; it finds only part of the problems.
- Docker image build, GitHub Actions workflow, Vercel deployment and the production host (no
  accounts or network access in the build environment).
- Sending real email. SMTP delivery was tested against a local test SMTP server only, not a real
  provider.
- Windows: the owner's run passed the integration (including the 413 test), unit and build checks.
  The quick end-to-end set had three timing failures on his slower machine; a fix is in this archive
  and still needs a Windows re-run ([PHASE_3_REPORT.md](PHASE_3_REPORT.md)).
- Behaviour with the API running as several instances (rate limits are per process).
- Backup and restore on a hosted database provider, and point-in-time recovery.
- Performance beyond the single-machine baseline in [PERFORMANCE.md](PERFORMANCE.md).
- Penetration testing. Security checks are automated tests written by the same team; an independent
  review is recommended before the system holds real company data.

## Known trade-offs

- All pages are rendered per request because branding and the session are read at request time.
- The health endpoint is public and the Overview page shows its version and environment name. A
  minimal public check separate from a detailed authenticated one is still to do.
- `BRAND_COMPANY_NAME` appears on the public pages and under Web branding on Settings; the sidebar
  shows the company's real name from the database. The Settings panel also names any `BRAND_*`
  variable that was ignored and why, never its value.
- The failed sign-in attempts of addresses with no account are in the audit table but in no
  company's audit view ([AUDIT_LOGGING.md](AUDIT_LOGGING.md)).
- If the database is down, a signed-in person sees "The SmartPack service is not reachable" (the API
  answers 503 for session checks), not the more detailed Phase 2 status panel, because that panel
  now sits behind sign-in.
