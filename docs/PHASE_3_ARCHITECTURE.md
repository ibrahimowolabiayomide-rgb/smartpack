# Phase 3 architecture: backend foundation, authentication and access control

This document records how Phase 3 is built and why. Detail lives in the topic documents it links to.

## What Phase 3 adds

A company can now exist in the system, people can sign in to it, and what each person may see and
do is decided by the server. Nothing about SmartPacks, workers, custody or tracking is built yet
(Phases 4 to 10).

- Companies (organizations), people (users), the link between them (memberships) and their roles.
- Sign-in, sign-out, session management, password reset, password change, email verification.
- Invitations: the only way a new person joins a company.
- Role-based access control (RBAC) that denies by default, with company isolation.
- An append-only audit log of security and administration events.
- A first-owner bootstrap command, because there is deliberately no public sign-up.
- Web screens for all of the above, using the Phase 2 design system.

## Request pipeline (API)

Every request passes the same guards, in this order. They are registered globally, so a new
controller is protected without anyone remembering to ask for it.

```
request
  -> OriginGuard        state-changing request that carries the session cookie must come from an
                        allowed web origin (CSRF defence, together with SameSite=Lax)
  -> RateLimitGuard     routes marked @RateLimit(...) are counted per client address
  -> AuthGuard          deny by default: a valid session is required unless the route is @Public()
  -> PermissionsGuard   @RequirePermissions('...') checks the caller's role permissions
  -> controller         Zod validates body, query and params; the service does the work
  -> AllExceptionsFilter  every error leaves as { error: { code, message, statusCode, requestId } }
```

Controllers stay thin. Services own the rules and run each multi-step change in one database
transaction, including the audit record, so a change and its audit entry exist together or not at all.

## Modules

| Module          | Responsibility                                                                           |
| --------------- | ---------------------------------------------------------------------------------------- |
| `auth`          | Login, logout, sessions, password reset and change, email verification, the three guards |
| `security`      | Argon2id hashing, password policy, one-time token generation, in-process rate limiter    |
| `organizations` | Read and update the current company                                                      |
| `members`       | List, read, edit, change role, suspend, reactivate and remove company members            |
| `roles`         | Read-only list of roles and permissions                                                  |
| `invitations`   | Create, resend, revoke, preview and accept invitations                                   |
| `audit`         | Writing audit events (inside the caller's transaction) and the paged read endpoint       |
| `email`         | Provider abstraction: `none`, `dev-capture`, `smtp`; templates; delivery log             |
| `bootstrap`     | `provisionFirstOwner`, used by the command-line tool only (not reachable over HTTP)      |
| `database`      | Drizzle and the `pg` pool, health check, migration runner                                |
| `health`        | Public health report (Phase 2, unchanged)                                                |

Shared contracts (Zod schemas and types for every request and response, the permission list and
the role list) live in `packages/shared`, so the API and the web app cannot disagree about a shape.

## Web architecture

The browser never talks to the API directly.

```
browser  ->  same-origin  /api/v1/*  (Next.js Route Handler "gateway")  ->  API (API_URL)
```

- The gateway forwards only the session cookie, the origin, the client address and a request id.
  It reads `API_URL` at run time, never exposes it to the browser, and refuses `dev/` paths.
- Because the cookie is set on the web origin, it works with the web and API on different hosts
  without third-party-cookie problems, and the API's CORS list does not need browser access.
- Server components fetch private data themselves, forwarding the session cookie.
- `proxy.ts` only checks that a session cookie exists and redirects to sign-in with a safe `next`
  address. It never decides access. The authoritative check is `(app)/layout.tsx`, which asks the
  API who the caller is on every render. An API that cannot be reached is shown as "service not
  reachable" and is never mistaken for "signed out".
- One-time links (invitation, reset, verification) carry their token in the URL fragment
  (`#token=...`), which browsers do not send to servers and which logs and Referer headers never
  contain. The page reads it and rewrites the address without it.

## Key decisions

| Decision          | Choice and reason                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session mechanism | Opaque random token in an HttpOnly cookie, SHA-256 hash stored. Revocable at once, nothing to decode. See [AUTHENTICATION.md](AUTHENTICATION.md). |
| Password hashing  | Argon2id at the OWASP minimum profile (19 MiB, time cost 2), configurable upward; production refuses lower values.                                |
| Roles             | Fixed set of seven roles seeded by migration. Custom roles are deferred (see [DEFERRED.md](DEFERRED.md)).                                         |
| Company isolation | Every private query is scoped by the caller's company taken from the session, never from the request. Another company's resource answers 404.     |
| Security events   | Stored in the single append-only `audit_logs` table with category `security`, not a second table. One ordered history is easier to reason about.  |
| Rate limiting     | In-process sliding window, no Redis. Per-process; see [RATE_LIMITING.md](RATE_LIMITING.md) for the consequence when scaled out.                   |
| Email             | Provider abstraction. Default sends nothing; development captures in memory; SMTP is available. No paid provider is required.                     |
| Database outage   | Connection-type failures map to `503 SERVICE_UNAVAILABLE` so callers can retry. Query bugs stay `500`.                                            |
| First company     | Created by a command-line tool run by an operator. No default password, no public registration.                                                   |

## Not in Phase 3

Worker records, SmartPack assets, QR codes, photographs, custody, GPS, inspections, alerts and
reports. Multi-factor authentication, single sign-on and custom roles are also not built. See
[DEFERRED.md](DEFERRED.md).
