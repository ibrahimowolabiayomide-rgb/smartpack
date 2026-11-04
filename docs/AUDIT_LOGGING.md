# Audit logging

The audit log is the company's record of who did what to access and administration. It is one
append-only table, `audit_logs` ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)). Security events (sign-ins,
failures, session and password events) are rows in the same table with category `security`; there is
no separate security-events table, so there is one ordered history to read.

## What is recorded

| Category         | Actions                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security`       | `auth.login.succeeded`, `auth.login.failed`, `auth.logout`, `auth.logout_all`, `auth.session.revoked`, `auth.sessions.revoked_others`, `auth.password.changed`, `auth.password_change.failed`, `auth.password_reset.requested`, `auth.password_reset.completed`, `invitation.accept.failed` |
| `account`        | `account.email.verification_requested`, `account.email.verified`, `invitation.accepted`, `member.profile_updated`                                                                                                                                                                           |
| `administration` | `organization.updated`, `invitation.created`, `invitation.resent`, `invitation.revoked`, `membership.created`, `membership.role_changed`, `membership.suspended`, `membership.reactivated`, `membership.removed`                                                                            |
| `system`         | `system.bootstrap`                                                                                                                                                                                                                                                                          |

Each row has: when, the company, the acting person (if known), category, action, outcome (`success`
or `failure`), the target (type and id), the request id, and a small `metadata` object (for example
the old and new role, or the reason a sign-in failed).

## What is never recorded

- Passwords, password hashes, tokens of any kind, cookies or authorization headers. A guard in the
  audit service **refuses to write** any metadata key that looks like one (`password`, `token`,
  `secret`, `hash`, `authorization`, `cookie`), so a careless future change fails loudly in tests
  instead of leaking quietly.
- Email addresses of failed sign-ins. A short one-way **fingerprint** of the address is stored so
  repeated attempts against one address can be recognised without keeping the address.
- Client IP addresses, except on `security` events, where they are kept for abuse investigation.

## Integrity

- **Same transaction.** For every change the audit row is written in the same database transaction
  as the change. An action cannot succeed without its record, and a rolled-back action leaves none.
  Failed sign-ins have no change to join; they are written on their own and a failure to write one
  never turns a rejected sign-in into a server error.
- **Append only.** Database triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on the table, including
  from the application's role (tested). A database owner could still drop a trigger deliberately.
- **Company scoped.** Reading is limited to the caller's company.

## Reading it

`GET /api/v1/organizations/current/audit-logs` needs `audit.view` (Owner, Administrator and
Auditor). Newest first, `limit` 1 to 100 (default 50), with filters `category`, `action`,
`actorId`, `targetType`, `targetId` and a `from`/`to` time range. Paging is by **keyset** on the row id (`cursor` returned as `nextCursor`), so a page costs the
same however large the table is and a new event cannot shift rows between pages. In the application:
**Settings, Audit log**.

## Known limits

- **Failed sign-ins for an address with no account** have no company, so they are not in any
  company's view. They are in the table (`organization_id` empty) for an operator with database
  access. A failed sign-in for a person who belongs to exactly one company is attributed to it.
- **Rate-limited attempts** (`429`) are not recorded; the failures that caused the block are.
- **No retention policy yet.** Nothing is ever deleted. Volume is modest (a few rows per sign-in or
  administrative action), but a retention period, archive and purge procedure should be decided
  before the table is large. Because deletion is blocked by design, any purge must be a deliberate,
  documented administrative operation (it needs the trigger lifted by someone with database
  ownership) and should itself be recorded. Your data-protection obligations for stored personal
  data (names, IP addresses on security events) are the company's to assess.
- **Not tamper-evident against the database owner.** There is no hash chain or external anchor.
- **Reads of the audit log are not themselves audited.**
