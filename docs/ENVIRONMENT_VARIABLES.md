# Environment variables

The source of truth for the API is `apps/api/src/config/env.schema.ts`. The API validates its
environment at start-up and exits with a readable message if anything is wrong. Messages name
variables and never print their values.

Empty values (for example `LOG_LEVEL=` copied from a template) are treated as unset.

## API (`apps/api`)

Local file: `apps/api/.env` (ignored by Git). Template: `apps/api/.env.example`.

| Variable                         | Required       | Default                                             | Secret  | Description                                                                                                                                                                    |
| -------------------------------- | -------------- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                       | no             | `development`                                       | no      | `development`, `test` or `production`. Production tightens defaults (below).                                                                                                   |
| `PORT`                           | no             | `4000`                                              | no      | Listening port, 1–65535. Hosting platforms normally inject it.                                                                                                                 |
| `HOST`                           | no             | `127.0.0.1` (dev/test), `0.0.0.0` (production)      | no      | Interface to bind.                                                                                                                                                             |
| `LOG_LEVEL`                      | no             | `debug` (dev), `info` (production), `silent` (test) | no      | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                                                                                                                |
| `CORS_ALLOWED_ORIGINS`           | **production** | `http://localhost:3000,http://127.0.0.1:3000` (dev) | no      | Comma-separated bare origins (`https://app.example.com`). No path, no trailing slash. Must be `https` in production.                                                           |
| `ENABLE_API_DOCS`                | no             | `true` (dev), `false` (production)                  | no      | `true` or `false`. Publishes Swagger UI at `/api/docs` and JSON at `/api/docs-json`.                                                                                           |
| `DATABASE_URL`                   | **always**     | none                                                | **yes** | `postgres://` or `postgresql://` URL. Must not contain `sslmode`/`ssl` parameters.                                                                                             |
| `DATABASE_SSL`                   | no             | `disable` (dev/test), `require` (production)        | no      | `disable`, `require` (encrypted, certificate verified) or `no-verify` (encrypted, not verified; discouraged).                                                                  |
| `DATABASE_POOL_MAX`              | no             | `10`                                                | no      | Maximum pooled connections, 1–100.                                                                                                                                             |
| `DATABASE_CONNECTION_TIMEOUT_MS` | no             | `5000`                                              | no      | How long to wait for a connection, 1–60000.                                                                                                                                    |
| `DATABASE_QUERY_TIMEOUT_MS`      | no             | `10000`                                             | no      | Client- and server-side limit per query, 1–120000.                                                                                                                             |
| `WEB_APP_URL`                    | **production** | none                                                | no      | Public origin of the web application, used to build the links in emails (`https://app.example.com`). Bare origin, no path. Must be `https` in production.                      |
| `TRUST_PROXY_HOPS`               | no             | `0`                                                 | no      | Number of reverse proxies in front of the API whose `X-Forwarded-For` is trusted (0 to 5). Behind the web gateway or Vercel use `1`. See [RATE_LIMITING.md](RATE_LIMITING.md). |
| `SESSION_IDLE_TIMEOUT_MINUTES`   | no             | `480` (8 hours)                                     | no      | A session unused for this long ends. 1 to 43200.                                                                                                                               |
| `SESSION_ABSOLUTE_TIMEOUT_HOURS` | no             | `168` (7 days)                                      | no      | A session ends this long after sign-in however active. 1 to 2160.                                                                                                              |
| `ARGON2_MEMORY_KIB`              | no             | `19456`                                             | no      | Argon2id memory cost. Production requires at least 19456.                                                                                                                      |
| `ARGON2_TIME_COST`               | no             | `2`                                                 | no      | Argon2id iterations. Production requires at least 2.                                                                                                                           |
| `ARGON2_PARALLELISM`             | no             | `1`                                                 | no      | Argon2id lanes, 1 to 16.                                                                                                                                                       |
| `INVITATION_TTL_HOURS`           | no             | `72`                                                | no      | How long an invitation link works. 1 to 720.                                                                                                                                   |
| `PASSWORD_RESET_TTL_MINUTES`     | no             | `60`                                                | no      | How long a password reset link works. 1 to 1440.                                                                                                                               |
| `EMAIL_VERIFICATION_TTL_HOURS`   | no             | `24`                                                | no      | How long an email verification link works. 1 to 336.                                                                                                                           |
| `EMAIL_PROVIDER`                 | no             | `none`                                              | no      | `none`, `dev-capture` (development and tests only) or `smtp`. See [EMAIL.md](EMAIL.md).                                                                                        |
| `EMAIL_FROM`                     | with `smtp`    | none                                                | no      | Sender address, for example `SmartPack <no-reply@your-company.example>`.                                                                                                       |
| `SMTP_HOST`                      | with `smtp`    | none                                                | no      | SMTP server host name.                                                                                                                                                         |
| `SMTP_PORT`                      | with `smtp`    | none                                                | no      | SMTP port (commonly 587 with STARTTLS, 465 with `SMTP_SECURE=true`).                                                                                                           |
| `SMTP_SECURE`                    | no             | `true` when `SMTP_PORT` is 465, otherwise `false`   | no      | `true` for implicit TLS. When `false`, STARTTLS is required except for `localhost` and `127.0.0.1`.                                                                            |
| `SMTP_USER`                      | no             | none                                                | **yes** | SMTP account. Set together with `SMTP_PASSWORD`.                                                                                                                               |
| `SMTP_PASSWORD`                  | no             | none                                                | **yes** | SMTP password or app key. Never logged.                                                                                                                                        |
| `RATE_LIMIT_DISABLED`            | no             | `false`                                             | no      | `true` turns the rate limiter off. For automated tests and measurements only; **refused in production**.                                                                       |
| `RATE_LIMIT_SCALE`               | no             | `1`                                                 | no      | Multiplies every rate-limit allowance (0.1 to 100).                                                                                                                            |

Why TLS is a separate variable: the PostgreSQL driver lets URL parameters override explicit SSL
settings and has changed how it interprets `sslmode` between releases. One explicit setting is
predictable, so URLs containing `sslmode`/`ssl` are rejected.

### What `NODE_ENV=production` changes

- `CORS_ALLOWED_ORIGINS` becomes required, and every origin must use `https`.
- `DATABASE_SSL` defaults to `require`.
- Swagger UI is off unless `ENABLE_API_DOCS=true`.
- 5xx responses carry a generic message; details go to the server log only.
- `Strict-Transport-Security` is sent; logs are JSON lines.
- `WEB_APP_URL` becomes required and must use `https`.
- `RATE_LIMIT_DISABLED=true` is refused.
- Argon2id must use at least 19,456 KiB of memory and a time cost of 2.
- `EMAIL_PROVIDER=dev-capture` is refused (it keeps messages in memory and serves them over HTTP).
- The session cookie is named `__Host-sp_session` and marked `Secure`.

### Migrations job

`pnpm db:migrate` reads only the database variables (`NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`,
`DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_QUERY_TIMEOUT_MS`), so a
migration job does not need the API's other settings.

### Email settings

`EMAIL_PROVIDER=smtp` requires `SMTP_HOST`, `SMTP_PORT` and `EMAIL_FROM`; `SMTP_USER` and
`SMTP_PASSWORD` must be given together or not at all. With `none` (the default) no email is sent and
the interface tells the administrator that invitation links must be shared another way. SMTP
providers differ in price and free allowance; this project does not choose one
([EMAIL.md](EMAIL.md)).

### First-owner command

`pnpm --filter @smartpack/api bootstrap` also reads `BOOTSTRAP_OWNER_PASSWORD` (secret) if you do not
want to type the password at the prompt. It is read from the environment of that one command, never
from a file in the repository, and is never logged. See [BOOTSTRAP.md](BOOTSTRAP.md).

## Web (`apps/web`)

Local file: `apps/web/.env.local` (ignored). Template: `apps/web/.env.example`.

| Variable             | Required                   | Default (development)          | Secret | Description                                                                                                                                                          |
| -------------------- | -------------------------- | ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL`            | **production and preview** | `http://127.0.0.1:4000/api/v1` | no     | Base URL of the API including `/api/v1`, without a trailing slash.                                                                                                   |
| `BRAND_COMPANY_NAME` | no                         | unset (no company named)       | no     | Company name, 1 to 80 characters. Shown on sign-in, in the public footer and under Web branding on Settings. The sidebar shows the company's name from the database. |
| `BRAND_LOGO_URL`     | no                         | unset (SmartPack mark)         | no     | A path in `apps/web/public` starting with `/`, or an `https` URL. Anything else is ignored.                                                                          |
| `BRAND_ACCENT_COLOR` | no                         | unset (forest green)           | no     | The single accent colour as `#rrggbb`. Ignored if text on it, or on the page, would fall below WCAG AA contrast (4.5:1).                                             |

All web variables are read **on the server only**. The web app has no `NEXT_PUBLIC_*` variables.
Anything prefixed `NEXT_PUBLIC_` is copied into the browser bundle, so never put a secret behind
that prefix.

Outside development a missing `API_URL` is reported on the Overview page instead of silently using
localhost.

### Branding variables

`BRAND_*` values are read for every request, so changing them needs a restart of the web server but
not a rebuild. An invalid value never breaks the interface: it is ignored, the default is used and
Settings shows a note naming the variable (never its value). With none set the application names no
company; nothing is invented. Because the root layout reads them per request, every page is rendered
on demand rather than prerendered (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Tests

| Variable                                                     | Used by                        | Description                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL`                                          | `test:integration`, `test:e2e` | Dedicated database. Read from the environment or `apps/api/.env.test.local`. The end-to-end launcher drops and recreates its own `smartpack_e2e` database next to it. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`                        | `test:e2e` (optional)          | Use an existing Chromium instead of Playwright's download.                                                                                                            |
| `PERF_API_URL`, `PERF_ORIGIN`, `PERF_EMAIL`, `PERF_PASSWORD` | `apps/api/perf/baseline.mjs`   | Target and credentials for the latency script ([PERFORMANCE.md](PERFORMANCE.md)). Throwaway database only.                                                            |
| `CI`                                                         | Playwright                     | Set by CI: enables retries and forbids `test.only`.                                                                                                                   |

## Rules

- Never commit `.env`, `.env.local` or `.env.test.local`. Only `*.example` files are tracked.
- Production values live in the hosting provider's secret store, not in the repository.
- Keep development, preview and production values separate; never point preview at production data.
