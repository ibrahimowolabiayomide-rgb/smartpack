# Creating the first company and Owner

SmartPack has **no public registration and no default account**. On a new installation the first
company and its Owner are created once, by an operator, with a command-line tool. After that,
everyone joins by invitation.

## What the command does

- Creates one company and one Owner account with the Owner role, in one transaction.
- Hashes the password with Argon2id and enforces the same password policy as everywhere else.
- Writes a `system.bootstrap` audit event (no password, no token).
- Leaves the Owner's address **unverified** unless you pass `--email-verified`.
- Is **not reachable over HTTP**. It runs only where someone can run a command with the database
  credentials, which is the control that makes it safe.

## What it refuses to do

- **Run twice.** If any company exists it stops with "An organization already exists" and changes
  nothing. Several simultaneous runs are serialised by a database advisory lock, so exactly one wins
  (tested).
- **Accept a weak password**, a malformed email, a bad slug, time zone or country. Nothing is created.
- **Take the password as a command-line argument.** That would put it in shell history and process
  lists. There is no default password and none is baked into the code, the migrations or the
  documentation examples that you should reuse.

## Running it

The database must already be migrated (`pnpm db:migrate`). The command reads the same `DATABASE_URL`
and `DATABASE_SSL` settings as the API (from the environment or `apps/api/.env`).

The password comes from one of three places:

1. **A hidden prompt** when run in a terminal (the simplest way on your own machine).
2. `--password-stdin`, reading one line from standard input.
3. The `BOOTSTRAP_OWNER_PASSWORD` environment variable, for automated runs from a secret store.

### Local development (Windows PowerShell)

```powershell
pnpm --filter @smartpack/shared build
pnpm --filter @smartpack/api build
pnpm db:migrate

pnpm --filter @smartpack/api bootstrap `
  --organization-name "Your Company Ltd" `
  --owner-email you@your-company.example `
  --owner-first-name Ada `
  --owner-last-name Okafor `
  --time-zone Africa/Lagos --country NG
# You are asked for the password; it is not echoed.
```

Add `--email-verified` only if you are certain the address is yours and you cannot receive email yet.

### Production

Run it once, from a trusted machine or as a one-off job on the API host, against the production
database, with the production `DATABASE_URL` (and `DATABASE_SSL`). Prefer the hidden prompt or
`--password-stdin` over an environment variable that stays set. Do **not** paste production secrets
into a chat, a ticket or a shared terminal log.

```bash
node apps/api/dist/cli/bootstrap.js \
  --organization-name "Your Company Ltd" \
  --owner-email owner@your-company.example \
  --owner-first-name Ada --owner-last-name Okafor
```

Then sign in, and use **Settings, Account and security** to confirm the address (needs an email
provider, [EMAIL.md](EMAIL.md)) and **Settings, Members** to invite everyone else.

## Exit codes and messages

| Exit code | Meaning                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| 0         | Created. Prints the company name, its reference (slug) and the Owner's address.       |
| 1         | Refused or failed: already provisioned, no terminal for the prompt, database problem. |
| 2         | Invalid input (for example a password that breaks the policy). Nothing was created.   |

Messages name the problem and never print the password or database credentials.

## Recovering access

There is no "forgot Owner" backdoor. If the only Owner loses their password, they use **Forgot your
password** (needs email). If email is not available, an operator with database access must set a new
hash deliberately; this is an administrative procedure, not a feature, and should be audited
by whoever runs it. A second Owner is the safer arrangement: invite one early.

## Verified

Tested against a clean database in the integration suite (creates every table, seeds reference data,
refuses weak input, one winner among simultaneous runs, hashed password, audit event, refuses a
second run) and by hand on the built command (no password supplied and no terminal: refused; weak
password: refused with exit 2; good password: created; second run: refused).
