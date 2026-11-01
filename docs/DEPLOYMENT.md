# Deployment

SmartPack is two deployable applications and one database. **Nothing has been deployed in
Phase 1**: it needs your Vercel account, a backend host and a production database. This document
gives the exact steps and says what was and was not verified.

```
Browser ──► Web (Next.js, Vercel) ──server-side fetch──► API (NestJS, Node host) ──► PostgreSQL + PostGIS
```

The **browser never calls the API directly**: the web app fetches data on the server. CORS is nevertheless configured and tested for when later phases add browser calls.

## What was verified

| Item                                                                                                      | Status                                        |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Web production build (`next build`) and start (`next start`)                                              | Verified                                      |
| API production bundle (`pnpm deploy --prod`): migrate, start, health, HSTS, docs hidden, fail-fast config | Verified                                      |
| `vercel.json` and monorepo settings below                                                                 | **Not verified** (needs a Vercel project)     |
| `apps/api/Dockerfile`                                                                                     | **Not verified** (no Docker daemon available) |
| `.github/workflows/ci.yml`                                                                                | **Not verified** (runs on first push)         |

## Order of operations for any release

1. Back up the production database.
2. **Migrate**: run `node dist/database/migrate.js` (or `pnpm db:migrate`) against the production
   database. It must succeed before step 3.
3. **Deploy the API.** Confirm `GET /api/v1/health` returns 200 with `status: "ok"`.
4. **Deploy the web app.**

Migrations should be backwards-compatible with the previous API release, so a failed deploy can be
rolled back without a database restore.

## Web application on Vercel

The web app is a standard Next.js application inside a monorepo. It imports the `@smartpack/shared`
workspace package, so Vercel must be allowed to read files outside `apps/web`.

1. Push the repository to GitHub (below), then in Vercel choose **Add New → Project** and import it.
2. Set **Root Directory** to `apps/web`.
3. Under that setting, enable **Include source files outside of the Root Directory in the Build
   Step** (it is required for `packages/shared`).
4. Leave the framework preset as **Next.js**. `apps/web/vercel.json` sets:
   - install: `cd ../.. && pnpm install --frozen-lockfile`
   - build: `pnpm build` (builds `@smartpack/shared`, then `next build`)
5. Set environment variables (Project → Settings → Environment Variables), scoped separately:

   | Variable  | Production                        | Preview                        |
   | --------- | --------------------------------- | ------------------------------ |
   | `API_URL` | `https://<production-api>/api/v1` | `https://<staging-api>/api/v1` |

   Never point Preview at the production API or database. Do not create `NEXT_PUBLIC_*` variables
   for secrets.

6. Set the Node.js version to 22.x (Project → Settings → General).
7. **Pin pnpm with Corepack.** `vercel.json` overrides the install command, and Vercel's documentation
   says an override install command uses the _oldest_ pnpm in its build image, which cannot read this
   project's lockfile and violates `engines.pnpm`. Add the environment variable
   `ENABLE_EXPERIMENTAL_COREPACK` = `1` (all environments) so Vercel uses the `packageManager`
   version in the root `package.json` (`pnpm@10.28.0`). Check the first build log for the pnpm version.
   ([Vercel: Corepack](https://vercel.com/docs/builds/configure-a-build#corepack))
8. Deploy. Every pull request then receives a Preview deployment.

Every page is rendered per request: the root layout reads the `BRAND_*` variables at request time
(and the Overview and Help pages show live API data), so all pages are served by Vercel functions.
Only the icons, manifest and `robots.txt` are static. Set `BRAND_COMPANY_NAME`, `BRAND_LOGO_URL`
and `BRAND_ACCENT_COLOR` in the Vercel project's environment variables if the company wants its own
name, logo or accent colour (all optional; see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)).

If `API_URL` is missing, the Overview page shows "The API address is not configured" rather than
failing silently.

## Backend API

The API is a **long-running Node.js server**. It is not a static site and must not be deployed to
Vercel as one (it also relies on a persistent connection pool). Suitable hosts include any
container or Node platform (for example Render, Railway or Fly.io) or your own server with Docker
or systemd. Choose one that supports: Node 22, environment secrets, TLS termination, health checks,
and a one-off command for migrations.

### Requirements

- Node.js 22.12 or newer, **or** the container built from `apps/api/Dockerfile`
- Network access to PostgreSQL 16 + PostGIS
- The environment variables in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). Minimum for production:

  ```
  NODE_ENV=production
  DATABASE_URL=postgresql://<restricted-role>:<password>@<host>:5432/<db>
  DATABASE_SSL=require
  CORS_ALLOWED_ORIGINS=https://<your-production-web-domain>
  ```

  `PORT` is usually injected by the host. In production the API refuses to start without
  `CORS_ALLOWED_ORIGINS` or with a non-`https` origin.

- Health check path: `GET /api/v1/health` (200 healthy; 503 when the database is down)

### Option 1: Container

```bash
docker build -f apps/api/Dockerfile -t smartpack-api .          # from the repository root
docker run --rm --env-file prod.env smartpack-api node dist/database/migrate.js
docker run -d --env-file prod.env -p 4000:4000 smartpack-api
```

(Unverified: see the table above. Fix any build error in the Dockerfile before relying on it.)

### Option 2: Build on the host

Verified procedure (this is what the Dockerfile automates):

```bash
pnpm install --frozen-lockfile
pnpm --filter @smartpack/shared build
pnpm --filter @smartpack/api build
pnpm --filter @smartpack/api deploy --legacy --prod ./api-bundle   # production-only bundle
cd api-bundle
node dist/database/migrate.js    # apply migrations
node dist/main.js                # start the API
```

The bundle contains `dist/`, `drizzle/` (the SQL migrations) and production dependencies only.
Run `node dist/main.js` under a process manager (systemd, pm2) or the platform's runner so it
restarts on failure, and put a TLS-terminating reverse proxy or the platform's HTTPS in front.

### After deploying the API

- Check `https://<api>/api/v1/health`.
- Confirm Swagger is **not** public: `https://<api>/api/docs` should return 404.
- Set the web project's `API_URL` to `https://<api>/api/v1` and redeploy the web app.

## GitHub

Nothing has been pushed: the repository URL and your GitHub authentication are yours to provide.

```bash
git remote add origin https://github.com/<owner>/<repository>.git
git push -u origin main
```

The first push triggers `.github/workflows/ci.yml` (formatting, lint, types, unit and integration
tests against a PostGIS container, build, Playwright). The workflow uses no secrets. After it
passes once, enable branch protection on `main` and require the CI check.

## Separate environments

| Environment | Web               | API / database                   | Notes                                           |
| ----------- | ----------------- | -------------------------------- | ----------------------------------------------- |
| Local       | `pnpm dev`        | local API, local PostgreSQL      | `.env` files                                    |
| Preview     | Vercel Preview    | a staging API + staging database | Created per pull request; never production data |
| Production  | Vercel Production | production API + database        | Secrets only in the provider's secret store     |

## Remaining manual actions for deployment

1. Create the GitHub repository and push.
2. Create the Vercel project (steps above) and add `API_URL` for Production and Preview.
3. Choose a backend host and a production PostgreSQL with PostGIS; set the variables.
4. Run migrations, deploy the API, then the web app, and run the health checks above.
