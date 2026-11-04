# Frontend and backend communication

There are two ways the web app reaches the API. Both attach the person's session and neither
exposes the API's address or the session token to page scripts.

```
Server components ──apiGet / authedGet──► NestJS API ──► PostgreSQL + PostGIS
Browser forms ──► /api/v1/* gateway (Next.js Route Handler) ──► NestJS API
```

- **Server components** read data (`apiGet`, or `authedGet` which adds the session cookie from the
  request). The `(app)` layout calls `getSession()` (`GET /auth/me`, cached per render) before any
  page is shown.
- **Browser code** (sign-in, forms, buttons) calls `apiRequest` (`lib/api/browser.ts`), which sends
  to the same-origin gateway at `/api/v1/*` (`app/api/v1/[...path]/route.ts`). The session is an
  **HttpOnly** cookie, so scripts cannot read it; the browser attaches it. The gateway forwards only
  the content type, `Origin` (the API's CSRF check needs it), `Referer`, `User-Agent`, `Accept`, a
  request id, the client address (`X-Forwarded-For`, set by the platform in front of the app) and
  **only** the session cookie. It returns the API's status and body, `Set-Cookie`, `Retry-After` and
  the request id, and answers 404 for any path starting with `dev/` (the development mailbox) or
  containing `.`/`..`/empty segments. If the API cannot be reached or times out it answers `502` or
  `504` in the standard error envelope; if `API_URL` is not configured, `503`. The upstream
  timeout is 15 seconds.

## The client

`apiGet(path, dataSchema, options)`:

- builds the URL from `API_URL` (see `base-url.ts`); in development it defaults to
  `http://127.0.0.1:4000/api/v1`, elsewhere a missing value is an `unconfigured` result;
- sends `x-request-id` (a fresh UUID) so a failure can be matched to an API log line;
- uses `cache: 'no-store'` and a timeout (default 4 seconds);
- parses the API envelope and validates `data` against the shared Zod schema;
- never throws. It returns one of the kinds listed under "How failures are shown".

## What uses it today

- **Health** (`GET /health`): Overview, Help diagnostics and the diagnostics dialog. System status
  only; it is not presented as business data. 200 and 503 reports are both accepted and shown
  honestly.
- **Authentication and account**: sign-in, sign-out, forgot and reset password, change password,
  email verification, sessions list and revocation.
- **Company**: current company read and update, roles and permissions.
- **Members and invitations**: lists, role changes, suspend, reactivate, remove, invite, resend,
  revoke, accept.
- **Audit log**: filtered, cursor-paged list.

Every response is validated against the shared Zod contract before it is shown or trusted. The full
endpoint list is [API_REFERENCE.md](API_REFERENCE.md).

## How failures are shown

`apiRequest` never throws and returns `{ ok: false, code, message, fieldErrors, retryAfterSeconds?,
requestId? }`. Forms put `fieldErrors` next to the matching fields, show everything else in an alert
that includes the request id, and show the wait time for `RATE_LIMITED`. A session that has ended is
detected by the `(app)` layout on the next page load, which redirects to sign-in; a form submitted
in the meantime shows the API's `UNAUTHORIZED` message. Pages that read data show a load-failure panel naming what could not
be loaded (service unreachable, access refused, invalid response) with a way to try again; they
never show an empty list in place of a failure. The service-unreachable wording covers a database
outage too, because the API answers 503 for it.

Failure kinds for server reads:

| Result             | Meaning                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `ok`               | A valid response in an accepted status                                 |
| `unconfigured`     | `API_URL` is not set outside development                               |
| `unreachable`      | The request timed out or the network failed (reason is recorded)       |
| `http-error`       | The API answered with an error; its error envelope and request id kept |
| `invalid-response` | The body did not match the contract                                    |

## Adding an endpoint in a later phase

1. Define the request and response schemas in `packages/shared`.
2. Implement and test the API endpoint.
3. Call it from a server component with `authedGet(path, schema)` (reads) or from a client
   component with `apiRequest(method, path, { schema, body })` (changes).
4. Render each result kind; do not treat anything but `ok` as success.
5. Add the permission to `packages/shared/src/permissions.ts` and to the roles that need it, and
   protect the endpoint with `@RequirePermissions(...)`; deny-by-default means an unmarked endpoint
   is closed ([ACCESS_CONTROL.md](ACCESS_CONTROL.md)).
6. Promote the module in `lib/modules.ts` only when the page works end to end.
