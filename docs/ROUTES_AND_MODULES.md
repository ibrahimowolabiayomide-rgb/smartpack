# Routes and modules

Source of truth in code: `apps/web/src/lib/modules.ts` (the module registry) and the `src/app`
folder. A test asserts that every registered route has a page.

## Routes

| Route                     | Group      | Status      | What it shows                                                                           |
| ------------------------- | ---------- | ----------- | --------------------------------------------------------------------------------------- |
| `/`                       | `(public)` | Implemented | Landing page: purpose, six-step flow, table of what the build contains                  |
| `/login`                  | `(public)` | Not enabled | Sign-in form that validates input and states that sign-in is not enabled                |
| `/privacy`, `/terms`      | `(public)` | Placeholder | States plainly that the document has not been published                                 |
| `/dashboard`              | `(app)`    | Implemented | Overview: live service status from the API, asset summary marked "Not available"        |
| `/dashboard/smartpacks`   | `(app)`    | Planned     | Layout of SmartPack records (table, filters, pagination); no records                    |
| `/dashboard/workers`      | `(app)`    | Planned     | Layout of worker records; no records                                                    |
| `/dashboard/verification` | `(app)`    | Planned     | How a verification record will look (QR and photograph evidence); no records            |
| `/dashboard/tracking`     | `(app)`    | Planned     | Location history layout; states that no GPS source is connected                         |
| `/dashboard/custody`      | `(app)`    | Planned     | Tabs for current custody, handover records and history; no records                      |
| `/dashboard/inspections`  | `(app)`    | Planned     | Inspection record layout; no records                                                    |
| `/dashboard/alerts`       | `(app)`    | Planned     | Alert and incident layout; no records                                                   |
| `/dashboard/reports`      | `(app)`    | Planned     | Report catalogue layout; nothing can be generated                                       |
| `/dashboard/settings`     | `(app)`    | Planned     | Read-only company profile from the `BRAND_*` variables; other sections labelled planned |
| `/dashboard/help`         | `(app)`    | Implemented | How to read the screens, capability tables, evidence explainer, diagnostics             |
| any other path            | root       | Implemented | Not-found page with a way back                                                          |

No `(app)` route is protected. Authentication arrives in Phase 3, and an amber banner on every page
says so.

## Module to phase mapping

This mapping is the project's own proposal and **needs owner approval**.

| Module             | Planned phase | Backend it waits for                               |
| ------------------ | ------------- | -------------------------------------------------- |
| SmartPacks         | 4             | SmartPacks API and asset tables                    |
| Workers            | 5             | Workers API and worker accounts                    |
| Custody & Handover | 5             | Workers, SmartPacks and the custody ledger         |
| Verification       | 6             | QR identities, camera access and photo storage     |
| Inspections        | 6             | SmartPacks, inspector accounts and photo storage   |
| Tracking           | 7             | An authorised location source and location history |
| Alerts & Incidents | 8             | Security monitoring rules and the incidents API    |
| Reports            | 9             | Recorded business data and the reporting API       |
| Settings           | 3             | Authentication, user accounts and role permissions |

Settings sections vary: notifications are planned for Phase 8, GPS integrations for Phase 7, other
integrations and data management for Phases 9 and 10.

## Navigation

- **Main**: Overview, SmartPacks, Workers, Verification, Tracking, Custody & Handover, Inspections,
  Alerts & Incidents, Reports.
- **Secondary**: Settings, Help & Documentation.
- The top-bar Help menu links to Help & Documentation, Diagnostics, Privacy and Terms.

## Empty versus unavailable

- `EmptyState`: the module works and there are no records. No screen uses it yet, because no module
  works yet.
- `UnavailableState`: the module is not built. It names the phase and what it depends on.

A planned page never shows a number, a name or a record. Where a value would normally appear it says
"Not available" or "Not measured".
