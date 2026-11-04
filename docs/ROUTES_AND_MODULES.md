# Routes and modules

Source of truth in code: `apps/web/src/lib/modules.ts` (the module registry) and the `src/app`
folder. A test asserts that every registered route has a page.

## Routes

| Route                          | Group      | Status      | What it shows                                                                                           |
| ------------------------------ | ---------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `/`                            | `(public)` | Implemented | Landing page: purpose, six-step flow, table of what the build contains                                  |
| `/login`                       | `(public)` | Implemented | Real sign-in; remembers the page you were going to (`?next=`, same-site paths only)                     |
| `/forgot-password`             | `(public)` | Implemented | Request a reset link; the answer is the same whether or not the address has an account                  |
| `/reset-password`              | `(public)` | Implemented | Choose a new password from an emailed link (token in the URL fragment)                                  |
| `/accept-invitation`           | `(public)` | Implemented | Join a company from an invitation link: new account or an existing one                                  |
| `/verify-email`                | `(public)` | Implemented | Confirm an email address from an emailed link                                                           |
| `/privacy`, `/terms`           | `(public)` | Placeholder | States plainly that the document has not been published                                                 |
| `/dashboard`                   | `(app)`    | Implemented | Overview: live service status from the API, asset summary marked "Not available"                        |
| `/dashboard/smartpacks`        | `(app)`    | Planned     | Layout of SmartPack records (table, filters, pagination); no records                                    |
| `/dashboard/workers`           | `(app)`    | Planned     | Layout of worker records; no records                                                                    |
| `/dashboard/verification`      | `(app)`    | Planned     | How a verification record will look (QR and photograph evidence); no records                            |
| `/dashboard/tracking`          | `(app)`    | Planned     | Location history layout; states that no GPS source is connected                                         |
| `/dashboard/custody`           | `(app)`    | Planned     | Tabs for current custody, handover records and history; no records                                      |
| `/dashboard/inspections`       | `(app)`    | Planned     | Inspection record layout; no records                                                                    |
| `/dashboard/alerts`            | `(app)`    | Planned     | Alert and incident layout; no records                                                                   |
| `/dashboard/reports`           | `(app)`    | Planned     | Report catalogue layout; nothing can be generated                                                       |
| `/dashboard/settings`          | `(app)`    | Implemented | Company profile (editable with `organization.manage`); sections below; later sections labelled planned  |
| `/dashboard/settings/members`  | `(app)`    | Implemented | Members (search, filter, role, suspend, reactivate, remove) and invitations; needs `users.view`         |
| `/dashboard/settings/roles`    | `(app)`    | Implemented | The seven roles and the permission matrix; needs `users.view`                                           |
| `/dashboard/settings/audit`    | `(app)`    | Implemented | Filterable audit log with cursor paging; needs `audit.view`                                             |
| `/dashboard/settings/security` | `(app)`    | Implemented | Your profile, password change, active sessions, sign out everywhere, email verification                 |
| `/api/v1/*`                    | `api`      | Implemented | Same-origin gateway that forwards browser calls to the API ([FRONTEND_BACKEND.md](FRONTEND_BACKEND.md)) |
| `/dashboard/help`              | `(app)`    | Implemented | How to read the screens, capability tables, evidence explainer, diagnostics                             |
| any other path                 | root       | Implemented | Not-found page with a way back                                                                          |

## Protection

Every `(app)` route needs a valid session. Two layers apply:

1. `src/proxy.ts` sends a request that carries **no session cookie at all** to `/login?next=...`.
   It only looks for the cookie's presence and is a convenience, not the security boundary.
2. The `(app)` layout asks the API who the caller is (`GET /auth/me`) on every request. A missing,
   expired or revoked session redirects to sign-in; an API that cannot be reached shows an error
   page (it is never mistaken for "signed out"). The API itself enforces permissions on every
   endpoint, so hiding a navigation link is never the only protection.

### Settings addresses changed from Phase 2 (intentional)

Phase 2 put Settings on one page and linked to sections with anchors. Phase 3 moved the sections
that now hold real features to their own routes, so each can have its own permission check, loading
state and tests.

| Phase 2 address                                                                     | Phase 3 behaviour                                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/dashboard/settings#security-settings`                                             | Forwarded in the browser to `/dashboard/settings/security`                                     |
| `/dashboard/settings#user-management`                                               | Forwarded to `/dashboard/settings/members`                                                     |
| `/dashboard/settings#roles-and-permissions`                                         | Forwarded to `/dashboard/settings/roles`                                                       |
| `/dashboard/settings#company-profile`                                               | Unchanged: still an anchor on the Settings page                                                |
| `/dashboard/settings#notification-preferences`, `#integrations`, `#data-management` | Unchanged: still anchors on the Settings page, labelled planned                                |
| `/dashboard/settings#application-preferences`                                       | No destination. The section is not built ([DEFERRED.md](DEFERRED.md)); the link opens Settings |
| (new) `/dashboard/settings/audit`                                                   | The audit log, which did not exist in Phase 2                                                  |

The forwarding is done by a small client component because a URL fragment is never sent to the
server. It runs on arrival and when the fragment changes. No link inside the application, the
documentation or the tests used the three old anchors, so only bookmarks and external links are
affected.

The Settings sections appear in the sub-navigation only if the person holds the permission the
section needs. Opening one by address without that permission shows "You do not have access" and the
API refuses the underlying request anyway.

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
| Settings           | 3 (delivered) | Authentication, user accounts and role permissions |

Settings sections not yet built are labelled as planned: notifications are planned for Phase 8, GPS integrations for Phase 7, other
integrations and data management for Phases 9 and 10.

## Navigation

- **Main**: Overview, SmartPacks, Workers, Verification, Tracking, Custody & Handover, Inspections,
  Alerts & Incidents, Reports.
- **Secondary**: Settings, Help & Documentation.
- The top-bar Help menu links to Help & Documentation, Diagnostics, Privacy and Terms.

## Empty versus unavailable

- `EmptyState`: the module works and there are no records. Used by the Phase 3 lists (for example
  an organisation with no pending invitations, or an audit filter with no matches).
- `UnavailableState`: the module is not built. It names the phase and what it depends on.

A planned page never shows a number, a name or a record. Where a value would normally appear it says
"Not available" or "Not measured".
