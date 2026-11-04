# Roles, permissions, members and invitations

## The model

A **permission** is one thing a person may do (`users.invite`, `audit.view`). A **role** is a named
set of permissions. A **membership** gives one person one role in one company. A person's access in a
company is exactly the permissions of their role there, and nothing else.

Access is **deny by default**:

- Every API route requires a valid session unless it is explicitly marked `@Public()`.
- A route that needs a permission names it with `@RequirePermissions(...)`; a route that names none
  needs only a session. An integration test walks every registered route and fails if a route is
  neither public nor protected.
- The web interface hides what a person cannot use, but the API is the only authority. Every limit
  below is enforced by the server, and tests call the API directly to prove it.

## Roles

Seven fixed roles are created by migration. They are a starting point for later phases: permissions
for assets, workers, custody and so on exist already so roles do not need to change when those
modules arrive. Custom roles are deferred ([DEFERRED.md](DEFERRED.md)).

| Role (key)                                | Intended for                                                        | Permissions |
| ----------------------------------------- | ------------------------------------------------------------------- | ----------- |
| Company Owner (`owner`)                   | Primary administrator; the only role that may grant or remove Owner | 25 (all)    |
| Company Administrator (`admin`)           | Members, roles and settings; cannot grant or remove Owner           | 24          |
| Operations Manager (`operations_manager`) | Day-to-day operations across assets, workers, custody, reports      | 18          |
| Asset Manager (`asset_manager`)           | Asset records and inspections                                       | 10          |
| Supervisor (`supervisor`)                 | Oversees workers, handovers, verifications, inspections             | 11          |
| Auditor, read-only (`auditor`)            | Reviews records and the audit log, changes nothing                  | 11          |
| Worker (`worker`)                         | Field user; company profile only until worker modules exist         | 1           |

The full matrix is on **Settings, Roles** in the application and in
`packages/shared/src/permissions.ts`. The 25 permissions are: `organization.view`,
`organization.manage`, `organization.transfer_ownership`, `users.invite`, `users.view`,
`users.update`, `users.suspend`, `roles.manage`, `assets.view`, `assets.create`, `assets.update`,
`workers.view`, `workers.manage`, `verifications.view`, `verifications.manage`, `tracking.view`,
`custody.view`, `custody.manage`, `inspections.view`, `inspections.manage`, `alerts.view`,
`incidents.manage`, `reports.view`, `reports.export`, `audit.view`.

## Rules that stop people giving themselves more access

- **No privilege escalation.** You may give someone a role (by invitation or role change) only if
  you hold **every permission** that role carries. The Roles page and the role pickers show only
  roles you may assign, and the API refuses the rest with `403`.
- **Owner is special.** Only an Owner may invite someone as Owner, make someone an Owner, or change
  or remove an Owner. Administrators cannot touch Owners.
- **You cannot act on yourself** to change your own role, suspend yourself or remove yourself.
- **The last Owner cannot be removed, suspended or demoted.** The check runs under a lock on the
  company row, so two Owners cannot remove each other at the same moment and leave no Owner.
- **Company isolation.** The company comes from the caller's session, never from the request. A
  member, invitation or any other record that belongs to another company answers **404**, exactly as
  if it did not exist, so its existence is not revealed.

## Members

Endpoints are under `/api/v1/organizations/current/members` (see [API_REFERENCE.md](API_REFERENCE.md)).

| Action       | Permission      | Effect                                                                                                                                                             |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List, read   | `users.view`    | Paged; search by name or email; filter by status                                                                                                                   |
| Edit profile | `users.update`  | First, last and display name. Refused (`409`) when the account also belongs to another company, because one company must not rewrite a person's identity elsewhere |
| Change role  | `roles.manage`  | Subject to the escalation, Owner, self and last-Owner rules                                                                                                        |
| Suspend      | `users.suspend` | Membership becomes `suspended`; **every session in this company ends immediately**; the person cannot sign in to this company                                      |
| Reactivate   | `users.suspend` | Membership returns to `active`; the person signs in again                                                                                                          |
| Remove       | `users.suspend` | Membership becomes `removed` (kept for history); sessions end. The person can be invited again                                                                     |

Removing a person never deletes their account or any record that refers to them. Their account may
belong to other companies, and audit history must keep pointing at real people.

## Invitations

The only way for a new person to join a company.

1. A person holding `users.invite` creates an invitation: an email address and a role. At most one
   **pending** invitation exists per address per company; inviting an address that is already a
   member, or already pending, is refused (`409 CONFLICT`). The sender is limited to 30 invitations
   per hour.
2. The API creates a random single-use token (valid 72 hours, `INVITATION_TTL_HOURS`), stores its
   SHA-256 hash, and emails a link `WEB_APP_URL/accept-invitation#token=...`. **Resend** issues a
   new token and invalidates the old one. **Revoke** withdraws a pending invitation.
3. The invitee opens the link. The page asks the API to **preview** the invitation (company name,
   role, whether an account already exists for the address) without using it up.
4. **Accept**:
   - New person: first name, last name and a password that meets the policy. An account and
     membership are created.
   - Existing account: the person enters their **current password** to prove it is theirs, and the
     membership is added. (Receiving the email alone does not let someone attach a company to an
     account.)
5. The invitation is claimed first, with a conditional update, before anything else is created, so a
   link cannot be used twice even by two simultaneous requests. A used, expired, revoked or unknown
   token returns `400 INVALID_TOKEN` and the page says "This invitation cannot be used".

Invitation state: `pending`, then `accepted` or `revoked`. "Expired" is not stored; it is a pending
invitation whose `expires_at` has passed, and it is shown that way. Inviting the same address again
renews it.

Unauthenticated invitation endpoints (`preview`, `accept`) are rate limited per client address, and
failed acceptances are limited per address and email ([RATE_LIMITING.md](RATE_LIMITING.md)).

## Where each rule is tested

`apps/api/test/access.integration.spec.ts` (role seed equals the shared definitions, permission
checks, escalation, Owner rules, last-Owner guard, company isolation, suspension ends sessions,
invitation lifecycle and races, audit immutability), `apps/api/test/security.integration.spec.ts`
(every registered route is protected and the public set is exactly a reviewed list) and
`packages/shared/src/access.test.ts`. The browser journey (invite, accept, limited access,
suspend, lose access, reactivate) is in `apps/web/e2e/auth-journeys.spec.ts`.
