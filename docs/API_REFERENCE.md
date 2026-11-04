# API reference (Phase 3)

Every route is under `/api/v1`. The live, generated reference is Swagger UI at `/api/docs` (JSON at
`/api/docs-json`); it is on by default in development and off in production unless
`ENABLE_API_DOCS=true`. This page is a human summary; the Zod schemas in `packages/shared/src` are the
exact contract.

## Conventions

- **JSON** request and response bodies (`Content-Type: application/json`). Bodies larger than the
  limit answer `413`; a wrong content type answers `415`.
- **Success**: `{ "data": <payload> }`. **Lists** are `{ "data": { "items": [...], "page", "pageSize", "total" } }`
  (page based; members, invitations) or `{ "items": [...], "nextCursor": ... }` (cursor based; audit).
- **Errors**: always `{ "error": { "code", "message", "statusCode", "requestId", "details?" } }`.
  Branch on `code`, never on `message`. `requestId` equals the `x-request-id` response header and the
  server log, so a report can be matched to a request. `details` (validation only) is a list of
  `{ path, message }`.
- **Authentication**: the session cookie (`sp_session`, or `__Host-sp_session` in production). Send
  it back with every request. A state-changing request that carries the cookie must also carry an
  allowed `Origin` header ([AUTHENTICATION.md](AUTHENTICATION.md)).
- **Private responses** carry `Cache-Control: no-store`.
- **Validation** runs on the server for every body, query and path parameter. Unknown fields in
  strict bodies are rejected.

## Endpoints

"Public" needs no session. Otherwise the permission in the third column is required (`session` means
any signed-in person).

### Health

| Method and path | Access | Purpose                                                                               |
| --------------- | ------ | ------------------------------------------------------------------------------------- |
| `GET /health`   | public | Service, database and PostGIS status. `200` healthy, `503` when the database is down. |

### Authentication and account

| Method and path                        | Access  | Rate limit | Purpose                                                                                   |
| -------------------------------------- | ------- | ---------- | ----------------------------------------------------------------------------------------- |
| `POST /auth/login`                     | public  | yes        | Body `{ email, password, organizationSlug? }`. Starts a session; returns the current user |
| `POST /auth/logout`                    | session |            | Ends this session                                                                         |
| `POST /auth/logout-all`                | session |            | Ends every session of this person                                                         |
| `GET /auth/me`                         | session |            | Current user, company, role, permissions and session                                      |
| `POST /auth/password/forgot`           | public  | yes        | Body `{ email }`. Always `202`                                                            |
| `POST /auth/password/reset`            | public  | yes        | Body `{ token, newPassword }`. Ends all sessions                                          |
| `POST /auth/password/change`           | session | yes        | Body `{ currentPassword, newPassword }`. Ends other sessions, keeps this device           |
| `POST /auth/email/verify`              | public  | yes        | Body `{ token }`                                                                          |
| `POST /auth/email/resend-verification` | session | yes        | Sends a new verification link                                                             |
| `GET /auth/sessions`                   | session |            | This person's active sessions (`current` marks this one)                                  |
| `DELETE /auth/sessions/:sessionId`     | session |            | Ends one of their own sessions                                                            |
| `POST /auth/sessions/revoke-others`    | session |            | Ends every session except this one                                                        |

### Company

| Method and path                          | Permission            | Purpose                                                                                 |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `GET /organizations/current`             | `organization.view`   | The caller's company                                                                    |
| `PATCH /organizations/current`           | `organization.manage` | Body: any of `name`, `timeZone` (IANA), `country` (ISO alpha-2 or `null`); at least one |
| `GET /organizations/current/roles`       | `users.view`          | Roles with permissions and whether the caller may assign each (`assignable`)            |
| `GET /organizations/current/permissions` | `users.view`          | The permission list                                                                     |

### Members

| Method and path                                            | Permission      | Purpose                                               |
| ---------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `GET /organizations/current/members`                       | `users.view`    | Query: `page`, `pageSize`, `status`, `role`, `search` |
| `GET /organizations/current/members/:memberId`             | `users.view`    | One member                                            |
| `PATCH /organizations/current/members/:memberId`           | `users.update`  | `firstName`, `lastName`, `displayName`                |
| `PATCH /organizations/current/members/:memberId/role`      | `roles.manage`  | Body `{ role }`                                       |
| `POST /organizations/current/members/:memberId/suspend`    | `users.suspend` | Ends the member's sessions in this company            |
| `POST /organizations/current/members/:memberId/reactivate` | `users.suspend` |                                                       |
| `DELETE /organizations/current/members/:memberId`          | `users.suspend` | Marks the membership removed (kept for history)       |

### Invitations

| Method and path                                      | Access         | Rate limit | Purpose                                                                                                                                    |
| ---------------------------------------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /organizations/current/invitations`             | `users.view`   |            | Query: `page`, `pageSize`, `status`                                                                                                        |
| `POST /organizations/current/invitations`            | `users.invite` | yes        | Body `{ email, role }`. Returns the invitation and `emailDelivery` (`sent`, `failed` or `not_configured`)                                  |
| `POST /organizations/current/invitations/:id/resend` | `users.invite` | yes        | New token, old one invalid                                                                                                                 |
| `DELETE /organizations/current/invitations/:id`      | `users.invite` |            | Revokes a pending invitation                                                                                                               |
| `POST /invitations/preview`                          | public         | yes        | Body `{ token }`. Company, role, whether an account exists                                                                                 |
| `POST /invitations/accept`                           | public         | yes        | New person: `{ token, accountExists: false, firstName, lastName, password }`. Existing account: `{ token, accountExists: true, password }` |

### Audit

| Method and path                         | Permission   | Purpose                                                                                                         |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET /organizations/current/audit-logs` | `audit.view` | Newest first. Query: `limit`, `cursor`, `category`, `action`, `actorId`, `targetType`, `targetId`, `from`, `to` |

### Development only

`GET` and `DELETE /dev/mailbox` exist only with `EMAIL_PROVIDER=dev-capture` (never production) and
answer 404 otherwise. They are not in the OpenAPI document.

## Error codes

| Code                     | Status | Meaning and what to do                                                                                                                                                                                                                                                                      |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAD_REQUEST`            | 400    | The request could not be understood (for example malformed JSON)                                                                                                                                                                                                                            |
| `VALIDATION_FAILED`      | 400    | An input broke a rule. `details` lists each field and message                                                                                                                                                                                                                               |
| `UNAUTHORIZED`           | 401    | No valid session. Sign in again                                                                                                                                                                                                                                                             |
| `INVALID_CREDENTIALS`    | 401    | Sign-in failed. Intentionally identical for unknown address, wrong password and blocked accounts                                                                                                                                                                                            |
| `FORBIDDEN`              | 403    | Signed in but not allowed (missing permission, role rules, or a blocked origin)                                                                                                                                                                                                             |
| `NOT_FOUND`              | 404    | No such resource, **or it belongs to another company** (indistinguishable on purpose)                                                                                                                                                                                                       |
| `METHOD_NOT_ALLOWED`     | 405    | Wrong HTTP method                                                                                                                                                                                                                                                                           |
| `CONFLICT`               | 409    | The change clashes with current state (a pending invitation already exists, already a member, the action does not fit the current status such as suspending someone already suspended, removing the last active Owner, editing a profile of an account that belongs to another company too) |
| `INVALID_TOKEN`          | 400    | A one-time link is invalid, used, expired or withdrawn                                                                                                                                                                                                                                      |
| `PAYLOAD_TOO_LARGE`      | 413    | Body over the size limit                                                                                                                                                                                                                                                                    |
| `UNSUPPORTED_MEDIA_TYPE` | 415    | Body is not JSON                                                                                                                                                                                                                                                                            |
| `RATE_LIMITED`           | 429    | Too many attempts. Wait `Retry-After` seconds ([RATE_LIMITING.md](RATE_LIMITING.md))                                                                                                                                                                                                        |
| `SERVICE_UNAVAILABLE`    | 503    | Temporarily unavailable, for example the database cannot be reached. Safe to retry                                                                                                                                                                                                          |
| `INTERNAL_ERROR`         | 500    | A bug or unexpected failure. In production the message is generic; the detail is in the server log under the same `requestId`                                                                                                                                                               |

The web gateway answers `502` (the API could not be reached) or `504` (it timed out) with the same
envelope when it cannot get an answer from the API at all.
