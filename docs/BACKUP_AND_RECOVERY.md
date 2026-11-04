# Backup and recovery

The database holds everything that matters: companies, people, password hashes, roles, sessions and
the audit history. There is nothing else to back up for Phase 3: the API and web app hold no state
of their own (the in-memory rate-limit counters and the development mailbox are disposable).

## What to protect

- **The database.** Back it up on a schedule and before every release (step 1 of the release order in
  [DEPLOYMENT.md](DEPLOYMENT.md)).
- **Secrets**, kept separately in your host's secret store: `DATABASE_URL`, `SMTP_PASSWORD`. Losing a
  secret means issuing a new one, not restoring an old one.
- **Backups are as sensitive as the database.** They contain password hashes and personal data.
  Encrypt them, restrict who can read them, and delete old ones on a schedule.

## Hosted PostgreSQL

Most managed PostgreSQL services offer automatic daily backups and point-in-time recovery, some on
free tiers with short retention and some only on paid plans. **Check what your chosen provider
includes and what it costs before relying on it**; this project does not choose or sign up for one.
Whatever the provider does, also keep your own periodic `pg_dump` copy somewhere you control.

## Taking a backup

`pg_dump` in custom format is compressed and restores selectively. Use the PostgreSQL 16 client
tools. The connection string is a secret: take it from your secret store, do not type it into a
shared terminal.

```powershell
# Windows PowerShell (PostgreSQL client tools installed and on PATH)
$env:PGPASSWORD = "<password>"   # or use a pgpass file
pg_dump -h <host> -p 5432 -U <user> -d <database> -Fc -f "smartpack-$(Get-Date -Format yyyyMMdd-HHmm).dump"
```

```bash
pg_dump -h <host> -U <user> -d <database> -Fc -f smartpack-$(date +%Y%m%d-%H%M).dump
```

## Restoring

Restore into a **new, empty** database, check it, then point the API at it. Never restore over a
live database.

```powershell
createdb -h <host> -U <user> smartpack_restored
psql -h <host> -U <user> -d smartpack_restored -c "CREATE EXTENSION IF NOT EXISTS postgis"
pg_restore -h <host> -U <user> -d smartpack_restored --no-owner --exit-on-error smartpack-YYYYMMDD-HHMM.dump
```

Then check: `SELECT count(*) FROM users;`, `SELECT count(*) FROM audit_logs;`, and
`SELECT count(*) FROM drizzle.__drizzle_migrations;` (3 in Phase 3). Start the API against the
restored database and confirm `GET /api/v1/health` is `ok` and an Owner can sign in.

Things to know:

- **Sessions come back with the restore.** People who were signed in at backup time are signed in
  again, until their normal expiry. If you restore because of a suspected breach, end every session
  afterwards (`UPDATE sessions SET revoked_at = now(), revoked_reason = 'restore' WHERE revoked_at IS NULL;`
  run by someone with database ownership) and rotate secrets.
- **Unused invitation and reset links come back too.** After a breach, revoke pending invitations and
  expire reset tokens the same way.
- Restoring does not need migrations to be re-run; the migration history is part of the dump.

## Verified

A backup and restore were performed on a copy of the development database (custom-format dump,
restore into a new database with PostGIS enabled). After the restore the row counts of `audit_logs`
(100,102 rows), `users` and `roles` matched, the migration history held 3 records, both append-only
audit triggers were present, and a `DELETE` on the restored `audit_logs` was still refused.

**Not verified:** restoring on a hosted provider, a point-in-time recovery, restore time at production
size, and the Windows commands themselves (they are the standard `pg_dump` and `pg_restore` options
run here on Linux).

## Recommendations to decide

Backup frequency, retention period, who may restore, where copies are stored, and a restore drill
(restore the newest backup into a scratch database every quarter and check it) are operational
decisions for the company. They are not enforced by the software.
