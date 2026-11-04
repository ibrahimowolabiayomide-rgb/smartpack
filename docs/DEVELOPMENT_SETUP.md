# Development setup

How to get SmartPack running on your own machine, and how to verify it. Every command here was run
while building Phases 1 to 3 on Linux; anything that was not (and could not be) verified is marked **Unverified**.

## 1. Tools

| Tool       | Version                       | Notes                                                        |
| ---------- | ----------------------------- | ------------------------------------------------------------ |
| Node.js    | 22.12 or newer (22.23.4 used) | `.node-version` pins the version for nvm/fnm/volta           |
| pnpm       | 10.28 or newer                | `corepack enable` installs the version in `packageManager`   |
| Git        | any recent version            |                                                              |
| PostgreSQL | 16 with PostGIS               | Docker or native, see [DATABASE_SETUP.md](DATABASE_SETUP.md) |
| Docker     | optional                      | Only for the Compose database                                |

Node 22.12+ is required because the API is ESM-only (NestJS 12) and because the scripts use
`node --env-file-if-exists`.

## 2. Install

```bash
git clone <your-repository-url> smartpack
cd smartpack
corepack enable
pnpm install
```

`pnpm install` refuses to run on an unsupported Node version (`engine-strict` in `.npmrc`).

## 3. Environment files

Three files, all ignored by Git. Copy the examples and fill in real values.

```bash
cp apps/api/.env.example        apps/api/.env              # API settings + DATABASE_URL
cp apps/api/.env.test.example   apps/api/.env.test.local   # TEST_DATABASE_URL for tests
cp apps/web/.env.example        apps/web/.env.local        # API_URL for the web server
```

PowerShell equivalents: `Copy-Item apps\api\.env.example apps\api\.env`, and the same for the
other two.

For local development also set these in `apps/api/.env` (they are commented placeholders in the
example):

```
WEB_APP_URL=http://localhost:3000
EMAIL_PROVIDER=dev-capture
```

`dev-capture` keeps outgoing messages in memory so you can read invitation and reset links without
an email provider (see step 6 and [EMAIL.md](EMAIL.md)). It is refused in production.

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for every variable.

## 4. Database

Create the development and test databases ([DATABASE_SETUP.md](DATABASE_SETUP.md)), put their
URLs in `DATABASE_URL` and `TEST_DATABASE_URL`, then apply migrations to the development database:

```bash
pnpm db:migrate
```

Use **two separate databases**. The integration tests apply migrations to the test database and
create and drop a temporary database beside it; they must never share a database with real data.

## 5. Create the first Owner

Phase 3 has no public registration and no default password. After migrating, create the company and
its first Owner once, with the bootstrap command (it asks for the password without echoing it):

```bash
pnpm --filter @smartpack/shared build
pnpm --filter @smartpack/api build
pnpm --filter @smartpack/api bootstrap --organization-name "Your Company Ltd" --owner-email you@your-company.example --owner-first-name Ada --owner-last-name Okafor
```

Run it with `--help` for every option. It refuses to run again once a company exists. Details,
including non-interactive use, are in [BOOTSTRAP.md](BOOTSTRAP.md).

## 6. Run

```bash
pnpm dev
```

- Web: http://localhost:3000. Open `/login` and sign in as the Owner you created. Everything under
  `/dashboard` needs a session; signed-out visits go to the sign-in page.
- API: http://localhost:4000/api/v1/health
- API documentation: http://localhost:4000/api/docs

The Overview page's "Service status" panel calls the API's health endpoint. If the API or database
is stopped, the panel shows an explicit error instead of a success state. "Check again" re-runs the
check.

To try invitations and password reset without an email provider, use `EMAIL_PROVIDER=dev-capture`
and read the captured messages at `GET http://localhost:4000/api/v1/dev/mailbox` (development only;
the link is in the message body). If your Owner's address is real, nothing is sent to it.

Run one app on its own with `pnpm --filter @smartpack/api dev` or `pnpm --filter @smartpack/web dev`.

## 7. Verify the whole setup

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm --filter @smartpack/web exec playwright install chromium   # once
pnpm test:e2e         # quick: 1440 and 390 px
pnpm test:e2e:full    # all five viewport widths
```

`pnpm test:e2e` builds all packages, starts two APIs (ports 4100 and 4101) and six production web
servers (ports 3100 to 3105) itself, and drives a real browser against them. Its launcher drops and
recreates a throwaway `smartpack_e2e` database, applies the migrations and creates a test Owner, so
the run never touches your development data. The quick set uses two widths (1440 and 390 px);
`pnpm test:e2e:full` uses five. The ports differ from `pnpm dev`, so the two can run at the same
time. The suite takes several minutes. See [TESTING.md](TESTING.md).

### If Playwright cannot download a browser

Some networks block the browser download host. Point Playwright at any Chromium you already have:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium pnpm test:e2e
```

(PowerShell: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\path\to\chrome.exe"`.) This override is
only for such cases; normally leave it unset.

## 8. Working with the code

- Shared contracts live in `packages/shared`. Root scripts rebuild it before running other
  packages, because the API and web import its compiled output.
- Add a database migration: edit `apps/api/src/database/schema/`, run `pnpm db:generate`, review
  the SQL, run `pnpm db:migrate`.
- Open API docs after adding an endpoint: http://localhost:4000/api/docs.

## Troubleshooting

| Symptom                                                     | Cause and fix                                                                                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration` when the API starts     | A variable is missing or malformed. The message lists names (never values). Fix `apps/api/.env`.                                                            |
| `DATABASE_URL: must not contain sslmode or ssl parameters`  | Remove `?sslmode=...` from the URL and set `DATABASE_SSL` instead.                                                                                          |
| Dashboard says "The API address is not configured"          | `API_URL` is unset outside development. Set it in `apps/web/.env.local` (or the host's settings).                                                           |
| Dashboard says "The API could not be reached"               | The API is not running, or `API_URL` points to the wrong host/port.                                                                                         |
| Health shows `degraded` / "PostGIS: Not installed"          | Run `pnpm db:migrate`; if that fails, the server lacks PostGIS ([DATABASE_SETUP.md](DATABASE_SETUP.md)).                                                    |
| `pnpm test:integration` says `TEST_DATABASE_URL is not set` | Create `apps/api/.env.test.local` from the example.                                                                                                         |
| Port already in use                                         | Stop the other process, or change `PORT` (API) / run Next with `--port`.                                                                                    |
| Sign-in always says "Email or password is incorrect"        | Intentional for every failure. Check the address, that a company exists (step 5) and that the account is active.                                            |
| Sign-in says "Too many attempts"                            | The rate limiter blocked the address or client. Wait the number of seconds shown, or restart the API in development ([RATE_LIMITING.md](RATE_LIMITING.md)). |
| Sign-in loops back to the login page                        | The API and web origins differ from `CORS_ALLOWED_ORIGINS`, or cookies are blocked. Use `localhost` consistently.                                           |
| `pnpm bootstrap` says a company already exists              | By design. Use invitations to add people ([BOOTSTRAP.md](BOOTSTRAP.md)).                                                                                    |
