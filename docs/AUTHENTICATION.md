# Authentication, sessions, password reset and email verification

## Summary

| Topic            | Behaviour                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up          | None. People join by invitation; the first Owner is created by the [bootstrap command](BOOTSTRAP.md).                                  |
| Credentials      | Email address and password. No multi-factor authentication yet ([DEFERRED.md](DEFERRED.md)).                                           |
| Password storage | Argon2id (19 MiB memory, time cost 2, parallelism 1 by default; production refuses less).                                              |
| Session          | Opaque random token in an HttpOnly cookie; only its SHA-256 hash is stored; checked against the database on every request.             |
| Cookie           | `sp_session` in development and test; `__Host-sp_session` in production. `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`. |
| Lifetime         | Idle timeout 8 hours and absolute limit 7 days by default (`SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_ABSOLUTE_TIMEOUT_HOURS`).          |

## Passwords

- Length 12 to 128 characters. There are no composition rules (they push people to predictable
  substitutions). The server refuses a password that is on the list of very common passwords, is a
  common word with digits or symbols around it, is a repetition of one (`passwordpassword`), is a
  keyboard or number sequence, or contains the person's email address or name.
- The policy runs on the server for sign-up by invitation, password change, password reset and the
  bootstrap command. The web forms repeat the check for convenience only.
- Hashing uses `@node-rs/argon2` (Argon2id). Verification of an unknown address still performs a
  hash, so response time does not reveal whether an account exists.
- A hash is upgraded to the current parameters at the next successful sign-in if it was made with
  weaker ones.

## Signing in

`POST /api/v1/auth/login` with `{ email, password }` and, only when the address belongs to more than
one company, `organizationSlug`.

1. Rate limits are checked ([RATE_LIMITING.md](RATE_LIMITING.md)).
2. The account, password and membership are verified. Unknown address, wrong password, a disabled
   account, a suspended or removed membership and a suspended company **all return the same
   `401 INVALID_CREDENTIALS`**, so the endpoint cannot be used to find out who has an account.
3. A new session replaces any session the browser already held, a cookie is set, `last_login_at`
   is updated, and an `auth.login.succeeded` audit event is written. A failure writes
   `auth.login.failed`.
4. The response is the current user (`GET /auth/me` shape) with `Cache-Control: no-store`.

If the address belongs to several companies and no `organizationSlug` was sent, the API asks for it
with a validation error and the web form shows a "Company reference" field.

## Sessions

- The cookie value is 32 random bytes (43 URL-safe characters). The database holds
  `SHA-256(token)` only, so a copy of the database cannot be used to impersonate anyone.
- Every request is checked with **one query** that requires the session to exist, not be revoked,
  not be past its absolute expiry, not be idle past the idle timeout, and its user, membership and
  company all to be active. Suspending a member, disabling a company or revoking a session
  therefore takes effect on the very next request.
- Activity updates `last_active_at` (a sliding idle window). The absolute expiry never moves.
- A session is bound to the company it was created in. A person who belongs to two companies signs
  in to each separately.

Ways a session ends: sign-out (`POST /auth/logout`), sign out everywhere (`POST /auth/logout-all`),
ending one device (`DELETE /auth/sessions/:id`), ending all other devices
(`POST /auth/sessions/revoke-others`), a password change or reset, suspension or removal of the
membership, idle timeout, absolute expiry. The reason is recorded in `revoked_reason`.

Anyone may list and end **their own** sessions only (`GET /auth/sessions`); someone else's session id
answers 404. The list never shows tokens.

## CSRF

The cookie is `SameSite=Lax`, so another site cannot make a browser send it on a POST. As a second
layer, any state-changing request that carries the session cookie must also carry an `Origin` (or
`Referer`) header from `CORS_ALLOWED_ORIGINS`, otherwise the API answers `403`. In the web app the
browser calls its own origin, and the gateway forwards the origin it received.

## Password change

`POST /auth/password/change` with the current password and a new one. The current password is
verified (a wrong one is a validation error on that field and counts toward a limit). On success
every session of that person is ended and **one new session** is issued for the device that made the
request, so other devices are signed out and this one stays signed in.

## Password reset

1. `POST /auth/password/forgot` with `{ email }`. The answer is always `202` with the same message,
   whether or not an account exists. If it does, a single-use token valid for 60 minutes
   (`PASSWORD_RESET_TTL_MINUTES`) is created and emailed as a link of the form
   `WEB_APP_URL/reset-password#token=...`. Earlier unused tokens for that person are invalidated.
2. The person opens the link. The page reads the token from the URL fragment and removes it from the
   address bar.
3. `POST /auth/password/reset` with `{ token, newPassword }`. The token is spent in the same
   transaction that sets the password. **All of the person's sessions end.** The address is also
   marked verified, because the person just proved they control the mailbox.
4. A used, expired or unknown token returns `400 INVALID_TOKEN`. Using the link twice fails the
   second time.

Only the SHA-256 hash of the token is stored. The email service records that a message was sent but
never its contents.

## Email verification

- A person whose address is not verified is told so (Settings, Account and security, with a button
  to resend). **Verification is displayed but not required** to sign in or use any feature in
  Phase 3. Whether to require it before sensitive actions is a product decision recorded in
  [DEFERRED.md](DEFERRED.md).
- `POST /auth/email/resend-verification` (3 per hour per person) sends a link valid for 24 hours
  (`EMAIL_VERIFICATION_TTL_HOURS`). `POST /auth/email/verify` with the token confirms the address.
- Accepting an invitation does **not** verify the address: an invitation proves someone typed it,
  not that they own it. The bootstrap command can attest the Owner's address with `--email-verified`.

## What the browser never sees

The password after the form is submitted (the field is cleared on failure), the session token
(HttpOnly), the API address (the gateway keeps it server side), stack traces, and which of
"unknown address" or "wrong password" happened.

## Logging

Request logs contain the request id, method, path, status and timing only. Cookies, authorization
headers, request bodies, passwords and tokens are not logged. This was checked on the built server
by signing in, failing a sign-in, requesting a reset and signing out at debug level, then searching
the log for the password, the session cookie value and the emailed token (zero matches).
