# Database schema (Phase 3)

PostgreSQL 16 with PostGIS. The schema is created only by the SQL migrations in `apps/api/drizzle/`
and mirrored by the Drizzle definitions in `apps/api/src/database/schema/`. The column lists below
were read from a database built by those migrations.

## Migrations

| File                                                   | What it does                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `0000_enable_postgis.sql`                              | Enables the PostGIS extension (Phase 1)                                           |
| `0001_auth_and_access_foundation.sql`                  | Creates all twelve Phase 3 tables, constraints and indexes                        |
| `0002_seed_access_reference_data_and_audit_guards.sql` | Seeds the 25 permissions, 7 roles and role grants; makes `audit_logs` append-only |

Migrations are forward-only. Apply them with `pnpm db:migrate`; the runner records what it applied
and does nothing when the database is already current. Never edit an applied migration; add a new
one. To change the schema: edit the Drizzle definition, run `pnpm db:generate`, review the SQL it
writes, and commit both. The seeded permissions and roles are configuration, not sample data: no
company, person or business record is ever created by a migration.

## Relationships

```
organizations 1 ──< memberships >── 1 users
                       │ >── 1 roles 1 ──< role_permissions >── 1 permissions
                       │
                       └──< sessions >── 1 users
organizations 1 ──< invitations >── 1 roles          (invited_by, accepted_by, revoked_by -> users)
users 1 ──< password_reset_tokens
users 1 ──< email_verification_tokens
organizations 1 ──< email_deliveries
organizations, users ──< audit_logs                   (both optional; append-only)
```

All foreign keys are `ON DELETE RESTRICT`: nothing is deleted by accident, and people are removed
from a company by changing their membership status, not by deleting rows.

## Tables

Types: `uuid` ids use `gen_random_uuid()`; `timestamptz` times default to `now()`.

### organizations

A company. `slug` is a stable, lower-case reference (2 to 48 characters, letters, digits, hyphens)
used to pick the company at sign-in when one account belongs to several.

| Column     | Type        | Null | Notes                                     |
| ---------- | ----------- | ---- | ----------------------------------------- |
| id         | uuid        | no   | primary key                               |
| name       | text        | no   | 2 to 120 characters after trimming        |
| slug       | text        | no   | unique; format enforced by a check        |
| status     | text        | no   | `active` or `suspended`, default `active` |
| time_zone  | text        | no   | IANA name, default `UTC`                  |
| country    | text        | yes  | two capital letters (ISO 3166-1 alpha-2)  |
| created_at | timestamptz | no   |                                           |
| updated_at | timestamptz | no   |                                           |

### users

A person's login identity. One user can belong to several companies.

| Column                              | Type        | Null | Notes                                               |
| ----------------------------------- | ----------- | ---- | --------------------------------------------------- |
| id                                  | uuid        | no   | primary key                                         |
| email                               | text        | no   | as entered, 3 to 254 characters                     |
| email_normalized                    | text        | no   | trimmed, lower-case; **unique**                     |
| password_hash                       | text        | no   | Argon2id PHC string; never returned by any endpoint |
| first_name, last_name, display_name | text        | no   | not blank                                           |
| status                              | text        | no   | `active` or `disabled`                              |
| email_verified_at                   | timestamptz | yes  | null until the address is confirmed                 |
| last_login_at                       | timestamptz | yes  |                                                     |
| password_changed_at                 | timestamptz | no   |                                                     |
| created_at, updated_at              | timestamptz | no   |                                                     |

### memberships

A person's place in a company: which role, and whether it is active.

| Column                   | Type        | Null | Notes                                                      |
| ------------------------ | ----------- | ---- | ---------------------------------------------------------- |
| id                       | uuid        | no   | primary key                                                |
| organization_id, user_id | uuid        | no   | together **unique**: one membership per person per company |
| role_id                  | uuid        | no   | references `roles`                                         |
| status                   | text        | no   | `active`, `suspended` or `removed`                         |
| activated_at             | timestamptz | no   |                                                            |
| suspended_at, removed_at | timestamptz | yes  | a check keeps them consistent with `status`                |
| created_at, updated_at   | timestamptz | no   |                                                            |

Indexes: `(organization_id, status)`, `(user_id)`, `(role_id)`.

### roles, permissions, role_permissions

Reference data seeded by migration `0002`. `roles(id, key unique, name, description, rank,
created_at)`; `permissions(key primary key, category, description)`; `role_permissions(role_id,
permission_key)` with a composite primary key. An integration test fails if the database and the
definitions in `packages/shared/src/permissions.ts` ever differ.

### sessions

One row per signed-in browser.

| Column                     | Type              | Null | Notes                                                                                         |
| -------------------------- | ----------------- | ---- | --------------------------------------------------------------------------------------------- |
| id                         | uuid              | no   | primary key; this is what the sessions list shows, **not** the token                          |
| user_id                    | uuid              | no   |                                                                                               |
| membership_id              | uuid              | no   | the company this session acts in                                                              |
| token_hash                 | text              | no   | SHA-256 hex (64 characters) of the cookie value; **unique**. The token itself is never stored |
| created_at, last_active_at | timestamptz       | no   |                                                                                               |
| expires_at                 | timestamptz       | no   | absolute expiry                                                                               |
| revoked_at, revoked_reason | timestamptz, text | yes  | both set together (check)                                                                     |
| user_agent                 | text              | yes  | for the sessions list                                                                         |
| ip_address                 | inet              | yes  |                                                                                               |

Partial indexes cover active sessions by user and by membership.

### invitations

| Column                           | Type              | Null | Notes                                                                    |
| -------------------------------- | ----------------- | ---- | ------------------------------------------------------------------------ |
| id                               | uuid              | no   |                                                                          |
| organization_id                  | uuid              | no   |                                                                          |
| email, email_normalized          | text              | no   |                                                                          |
| role_id                          | uuid              | no   | the role the person receives on acceptance                               |
| token_hash                       | text              | no   | SHA-256 hex; **unique**                                                  |
| invited_by_user_id               | uuid              | no   |                                                                          |
| status                           | text              | no   | `pending`, `accepted` or `revoked` (expiry is derived from `expires_at`) |
| expires_at, last_sent_at         | timestamptz       | no   |                                                                          |
| accepted_at, accepted_by_user_id | timestamptz, uuid | yes  | set together with `status = accepted` (check)                            |
| revoked_at, revoked_by_user_id   | timestamptz, uuid | yes  | set together with `status = revoked` (check)                             |
| created_at                       | timestamptz       | no   |                                                                          |

A **partial unique index** allows only one `pending` invitation per `(organization_id,
email_normalized)`.

### password_reset_tokens and email_verification_tokens

`(id, user_id, token_hash unique, expires_at, used_at, created_at)`; verification tokens also keep
`email_normalized`, the address being confirmed. A token is single use: it is spent by a
conditional `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`, so two simultaneous
attempts cannot both succeed.

### email_deliveries

A log of attempts to send an email: `(id, organization_id, template, to_email, status, provider,
provider_message_id, error, request_id, created_at)`. `status` is `sent` or `failed`. It never holds
the message body or any link, so it cannot leak a token. Nothing is logged when no provider is
configured.

### audit_logs

Append-only history. See [AUDIT_LOGGING.md](AUDIT_LOGGING.md).

| Column                         | Type        | Null | Notes                                                           |
| ------------------------------ | ----------- | ---- | --------------------------------------------------------------- |
| id                             | bigint      | no   | identity; strictly increasing, used for keyset paging           |
| occurred_at                    | timestamptz | no   |                                                                 |
| organization_id, actor_user_id | uuid        | yes  | either may be unknown (for example a failed sign-in)            |
| category                       | text        | no   | `security`, `account`, `administration` or `system`             |
| action                         | text        | no   | for example `membership.suspended`                              |
| outcome                        | text        | no   | `success` or `failure`                                          |
| target_type, target_id         | text        | yes  |                                                                 |
| request_id                     | text        | yes  | matches the `x-request-id` header and the server log            |
| ip_address                     | inet        | yes  | stored for `security` events only                               |
| metadata                       | jsonb       | no   | object, at most 4096 bytes; never holds secrets (see audit doc) |

Triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on this table, including from the application's own
database role. (A database owner or superuser could still drop the trigger on purpose; protect those
credentials accordingly.) Indexes: `(organization_id, id DESC)`, `(actor_user_id, id DESC)`,
`(organization_id, target_type, target_id, id DESC)`.

## What is not stored

Plain-text passwords, session tokens, invitation tokens, reset tokens, verification tokens, and the
contents of emails. Only SHA-256 hashes of tokens and Argon2id hashes of passwords exist.
