# Environment variables

The source of truth for the API is `apps/api/src/config/env.schema.ts`. The API validates its
environment at start-up and exits with a readable message if anything is wrong. Messages name
variables and never print their values.

Empty values (for example `LOG_LEVEL=` copied from a template) are treated as unset.

## API (`apps/api`)

Local file: `apps/api/.env` (ignored by Git). Template: `apps/api/.env.example`.

| Variable                         | Required       | Default                                             | Secret  | Description                                                                                                          |
| -------------------------------- | -------------- | --------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                       | no             | `development`                                       | no      | `development`, `test` or `production`. Production tightens defaults (below).                                         |
| `PORT`                           | no             | `4000`                                              | no      | Listening port, 1–65535. Hosting platforms normally inject it.                                                       |
| `HOST`                           | no             | `127.0.0.1` (dev/test), `0.0.0.0` (production)      | no      | Interface to bind.                                                                                                   |
| `LOG_LEVEL`                      | no             | `debug` (dev), `info` (production), `silent` (test) | no      | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                                                      |
| `CORS_ALLOWED_ORIGINS`           | **production** | `http://localhost:3000,http://127.0.0.1:3000` (dev) | no      | Comma-separated bare origins (`https://app.example.com`). No path, no trailing slash. Must be `https` in production. |
| `ENABLE_API_DOCS`                | no             | `true` (dev), `false` (production)                  | no      | `true` or `false`. Publishes Swagger UI at `/api/docs` and JSON at `/api/docs-json`.                                 |
| `DATABASE_URL`                   | **always**     | none                                                | **yes** | `postgres://` or `postgresql://` URL. Must not contain `sslmode`/`ssl` parameters.                                   |
| `DATABASE_SSL`                   | no             | `disable` (dev/test), `require` (production)        | no      | `disable`, `require` (encrypted, certificate verified) or `no-verify` (encrypted, not verified; discouraged).        |
| `DATABASE_POOL_MAX`              | no             | `10`                                                | no      | Maximum pooled connections, 1–100.                                                                                   |
| `DATABASE_CONNECTION_TIMEOUT_MS` | no             | `5000`                                              | no      | How long to wait for a connection, 1–60000.                                                                          |
| `DATABASE_QUERY_TIMEOUT_MS`      | no             | `10000`                                             | no      | Client- and server-side limit per query, 1–120000.                                                                   |

Why TLS is a separate variable: the PostgreSQL driver lets URL parameters override explicit SSL
settings and has changed how it interprets `sslmode` between releases. One explicit setting is
predictable, so URLs containing `sslmode`/`ssl` are rejected.

### What `NODE_ENV=production` changes

- `CORS_ALLOWED_ORIGINS` becomes required, and every origin must use `https`.
- `DATABASE_SSL` defaults to `require`.
- Swagger UI is off unless `ENABLE_API_DOCS=true`.
- 5xx responses carry a generic message; details go to the server log only.
- `Strict-Transport-Security` is sent; logs are JSON lines.

### Migrations job

`pnpm db:migrate` reads only the database variables (`NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`,
`DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_QUERY_TIMEOUT_MS`), so a
migration job does not need the API's other settings.

## Web (`apps/web`)

Local file: `apps/web/.env.local` (ignored). Template: `apps/web/.env.example`.

| Variable             | Required                   | Default (development)          | Secret | Description                                                                                                              |
| -------------------- | -------------------------- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `API_URL`            | **production and preview** | `http://127.0.0.1:4000/api/v1` | no     | Base URL of the API including `/api/v1`, without a trailing slash.                                                       |
| `BRAND_COMPANY_NAME` | no                         | unset (no company named)       | no     | Company name, 1 to 80 characters. Shown in the sidebar footer, on sign-in, in the footer and on Settings.                |
| `BRAND_LOGO_URL`     | no                         | unset (SmartPack mark)         | no     | A path in `apps/web/public` starting with `/`, or an `https` URL. Anything else is ignored.                              |
| `BRAND_ACCENT_COLOR` | no                         | unset (forest green)           | no     | The single accent colour as `#rrggbb`. Ignored if text on it, or on the page, would fall below WCAG AA contrast (4.5:1). |

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

| Variable                              | Used by                        | Description                                                                  |
| ------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `TEST_DATABASE_URL`                   | `test:integration`, `test:e2e` | Dedicated database. Read from the environment or `apps/api/.env.test.local`. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | `test:e2e` (optional)          | Use an existing Chromium instead of Playwright's download.                   |
| `CI`                                  | Playwright                     | Set by CI: enables retries and forbids `test.only`.                          |

## Rules

- Never commit `.env`, `.env.local` or `.env.test.local`. Only `*.example` files are tracked.
- Production values live in the hosting provider's secret store, not in the repository.
- Keep development, preview and production values separate; never point preview at production data.
