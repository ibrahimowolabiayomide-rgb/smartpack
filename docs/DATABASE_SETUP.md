# Database setup

SmartPack uses **PostgreSQL 16 with the PostGIS extension**. PostGIS is enabled by the first
migration so geographic columns (GPS positions, geofences) can be added in later phases without a
platform change. Phase 1 creates **no business tables**.

You need two databases locally: one for development and one for automated tests.

| Purpose     | Suggested name   | Variable            | Where it is set            |
| ----------- | ---------------- | ------------------- | -------------------------- |
| Development | `smartpack_dev`  | `DATABASE_URL`      | `apps/api/.env`            |
| Tests       | `smartpack_test` | `TEST_DATABASE_URL` | `apps/api/.env.test.local` |

## Option A — Docker Compose (simplest)

Requires Docker with Compose. **Unverified in the Phase 1 build environment**: its Docker daemon
could not run, so the Compose file was validated for syntax only (`docker compose config`).

```bash
docker compose up -d db
docker compose ps            # wait for "healthy"
```

This starts `postgis/postgis:16-3.4`, creates `smartpack_dev`, and (first start only) creates
`smartpack_test` through `docker/db-init/01-create-test-database.sql`. Use these URLs:

```
DATABASE_URL=postgresql://smartpack:smartpack_local_dev@localhost:5432/smartpack_dev
TEST_DATABASE_URL=postgresql://smartpack:smartpack_local_dev@localhost:5432/smartpack_test
```

The container's user is a superuser, which the migrations (they create an extension) and the
integration tests (they create a temporary database) need. Stop with `docker compose down`; add
`-v` to also delete the data. The port is bound to `127.0.0.1` only.

## Option B — Native PostgreSQL (no Docker)

This path **was** verified (PostgreSQL 16.15, PostGIS 3.4.2, Ubuntu 24.04).

1. Install PostgreSQL 16 and the PostGIS package for it.
   - Ubuntu/Debian: `sudo apt install postgresql-16 postgresql-16-postgis-3`
   - macOS (Homebrew): `brew install postgresql@16 postgis`
   - Windows: the EnterpriseDB PostgreSQL installer, then PostGIS from Stack Builder
2. Make sure the server is running (Ubuntu: `sudo pg_ctlcluster 16 main start`).
3. Create a role and the two databases. Replace `CHOOSE_A_PASSWORD`:

   ```sql
   -- psql as a PostgreSQL superuser (Ubuntu: sudo -u postgres psql)
   CREATE ROLE smartpack LOGIN SUPERUSER PASSWORD 'CHOOSE_A_PASSWORD';
   CREATE DATABASE smartpack_dev  OWNER smartpack;
   CREATE DATABASE smartpack_test OWNER smartpack;
   ```

   `SUPERUSER` is acceptable for a local development machine. In production use a restricted role
   (below).

4. Put the URLs in the environment files:

   ```
   DATABASE_URL=postgresql://smartpack:CHOOSE_A_PASSWORD@localhost:5432/smartpack_dev
   TEST_DATABASE_URL=postgresql://smartpack:CHOOSE_A_PASSWORD@localhost:5432/smartpack_test
   ```

   If the password contains characters such as `@`, `/` or `#`, URL-encode them.

## Apply migrations

```bash
pnpm db:migrate
```

Expected output: `Migrations applied successfully.` Migrations are idempotent: running the command
again applies nothing new. Applied migrations are recorded in the `drizzle.__drizzle_migrations`
table. Check PostGIS:

```bash
psql "$DATABASE_URL" -c "select postgis_version();"
```

Migrations are **never** run automatically when the API starts. That would let several instances
race to change the schema, and a schema change should be a deliberate deployment step.

## Verify the connection through the API

```bash
pnpm --filter @smartpack/api dev      # in one terminal
curl http://localhost:4000/api/v1/health
```

```json
{
  "data": {
    "status": "ok",
    "checks": { "database": { "status": "up", "latencyMs": 3 }, "postgis": { "status": "enabled" } }
  }
}
```

(Abridged.) The health endpoint runs a real query on every call:

| Situation                              | HTTP | `status`   | `checks.database` | `checks.postgis` |
| -------------------------------------- | ---- | ---------- | ----------------- | ---------------- |
| Database answers, PostGIS enabled      | 200  | `ok`       | `up`              | `enabled`        |
| Database answers, PostGIS missing      | 200  | `degraded` | `up`              | `missing`        |
| Database unreachable or too slow (3 s) | 503  | `error`    | `down`            | `unknown`        |

## Changing the schema

1. Edit `apps/api/src/database/schema/` (empty in Phase 1; the data model is designed in the
   architecture phase).
2. `pnpm db:generate` writes a new SQL file and updates `apps/api/drizzle/meta`.
3. Read the SQL. Commit the `.sql` file and the `meta` changes together.
4. `pnpm db:migrate` applies it.

For hand-written SQL (extensions, data fixes): `pnpm db:generate --custom --name=describe_change`.
Never edit a migration that has already been applied somewhere shared; add a new one.

## Production database

- Use a managed or self-run PostgreSQL 16 **that offers PostGIS**. Most major providers do, but
  availability and how to enable it differ, so confirm it for your provider before choosing one.
- Set `DATABASE_SSL=require` (the default in production). Use `no-verify` only as a temporary
  workaround for a private certificate authority.
- The migration role must be allowed to `CREATE EXTENSION postgis` (on many providers this is a
  one-time action by the admin role, after which the migration's `IF NOT EXISTS` is a no-op).
- Run the API with a **separate, restricted role** that has no rights to create extensions or
  databases. Granting table privileges to that role is part of the architecture phase.
- Back up before applying a migration, and rehearse migrations on a copy first.

## Troubleshooting

| Error                                             | Meaning and fix                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `extension "postgis" is not available`            | The PostGIS package is not installed on the database server. Install it (Option B step 1).                  |
| `permission denied to create extension "postgis"` | The role is not allowed to create extensions. Run the migration as a superuser/admin role.                  |
| `ECONNREFUSED` / health shows `down`              | PostgreSQL is not running, or the host/port in `DATABASE_URL` is wrong.                                     |
| `password authentication failed`                  | Wrong password in `DATABASE_URL`, or special characters not URL-encoded.                                    |
| `database "smartpack_test" does not exist`        | Create it (Option A: remove the volume with `docker compose down -v` and start again; Option B: SQL above). |
| `The server does not support SSL connections`     | Set `DATABASE_SSL=disable` for a local server without TLS.                                                  |
