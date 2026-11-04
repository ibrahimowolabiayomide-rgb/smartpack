# Performance baseline (Phase 3)

A measured baseline for the new authentication and company endpoints, so later phases can see
whether they made things slower. These are **real measurements from one run on a development
machine**, not production figures and not a capacity claim.

## Environment

- 2 vCPU, 8 GB RAM Linux virtual machine. **The load generator, the API and PostgreSQL all ran on
  that one machine**, so they competed for the same two cores. Production hosting with a separate
  database will behave differently (network latency to the database adds to every figure; dedicated
  CPU removes the contention).
- Node 22.23.4, PostgreSQL 16 with PostGIS, local connection (no network hop), pool of 10.
- API built (`pnpm build`) and run as `node dist/main.js`. Argon2id at the production minimum
  profile (19,456 KiB, time cost 2, parallelism 1). Rate limiting disabled for the run.
- Data: one company and one member, plus **100,000 synthetic audit rows** loaded directly into the
  throwaway database to see how the audit list behaves with a large table. The rows are
  measurement-only; no synthetic data exists in any product database or migration.
- Method: `apps/api/perf/baseline.mjs` (plain Node `fetch`, keep-alive). Sequential runs measure
  latency without queueing; concurrent runs show behaviour under load. Times are milliseconds
  measured by the client, including the HTTP round trip.

## Results

| Request                                                                     | Mode          | Requests | p50  | p95   | p99   | max   | Throughput |
| --------------------------------------------------------------------------- | ------------- | -------- | ---- | ----- | ----- | ----- | ---------- |
| `GET /health` (no auth, one database check)                                 | sequential    | 300      | 2.2  | 5.8   | 9.1   | 13.5  |            |
| `GET /auth/me` (session lookup, the per-request cost)                       | sequential    | 300      | 3.3  | 6.7   | 9.9   | 16.6  |            |
| `GET /organizations/current/members`                                        | sequential    | 200      | 5.0  | 9.3   | 14.9  | 15.1  |            |
| `GET /organizations/current/audit-logs?limit=50` (first page, 100,001 rows) | sequential    | 200      | 4.3  | 7.9   | 10.1  | 10.2  |            |
| `POST /auth/login` (Argon2id verify)                                        | sequential    | 40       | 24.2 | 31.6  | 34.5  | 34.5  |            |
| `GET /auth/me`                                                              | 10 concurrent | 2000     | 18.5 | 32.0  | 44.2  | 105.6 | 506 req/s  |
| `GET /auth/me`                                                              | 50 concurrent | 2000     | 73.7 | 109.0 | 242.3 | 564.9 | 631 req/s  |
| `POST /auth/login` (Argon2id)                                               | 8 concurrent  | 60       | 86.5 | 130.4 | 156.8 | 156.8 | 87 req/s   |

## What this shows

- The per-request authentication cost (one database query that checks session, user, membership
  and company together) is about 3 ms at the median on this machine.
- Password hashing dominates sign-in by design: about 24 ms of work per sign-in, deliberately. Sign-in
  throughput is limited by CPU (about 87 per second on two shared cores). That is far above what a
  company's sign-in rate needs, and it is the intended cost of resisting offline password cracking.
- The audit list stays flat (4.3 ms) with 100,000 rows because it pages by an indexed key
  (`(organization_id, id DESC)`), not by offset.
- Beyond about 10 concurrent requests on two shared cores, latency rises roughly linearly with
  concurrency, which is expected when the load generator and database share the CPU.

## What this does **not** show

- Behaviour with a remote database, several API instances, a real network, TLS, or the web
  application in front of the API. The web gateway adds one extra hop.
- Memory growth over time, sustained load beyond a few seconds, or failure behaviour under overload.
- Any other endpoint (invitations, role changes, password reset) or the web application's page
  render times. No Core Web Vitals measurement was made.
- Production capacity. Do not quote these figures as a service level.

## Reproducing

Against a throwaway database with `RATE_LIMIT_DISABLED=true` on the API (never production):

```powershell
$env:PERF_API_URL = "http://127.0.0.1:4000/api/v1"
$env:PERF_ORIGIN = "http://localhost:3000"
$env:PERF_EMAIL = "owner@your-company.example"
$env:PERF_PASSWORD = "<the owner's password>"
node apps/api/perf/baseline.mjs
```
