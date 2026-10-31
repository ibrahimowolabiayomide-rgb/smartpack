# Contributing to SmartPack

This is a company product. These conventions keep the history readable and the code reviewable.

## Ground rules

1. **Work within the assigned phase.** The project is built phase by phase; each phase is tested,
   documented and approved by the owner before the next begins. Do not implement later-phase
   features early.
2. **No fake functionality.** No invented users, bags, locations, statistics or API responses. If a
   feature does not exist yet, the interface says so (see the "Planned" labels in the navigation).
   Every feature that exists must talk to the real API and database.
3. **Justify dependencies.** Add a package only for a concrete need, pin its exact version, and say
   why in the pull request. Use pnpm only.
4. **Never commit secrets.** `.env` files are ignored; only `*.example` files with placeholders are
   tracked. If a secret is committed by mistake, rotate it — removing it from history is not enough.
5. **Validate on the server.** Client-side validation is a convenience; the API validates all input.

## Branches

`main` is always releasable and is changed only through pull requests.

| Prefix     | Use                       | Example                 |
| ---------- | ------------------------- | ----------------------- |
| `feature/` | New capability            | `feature/phase-2-auth`  |
| `fix/`     | Bug fix                   | `fix/health-timeout`    |
| `docs/`    | Documentation only        | `docs/deployment-guide` |
| `chore/`   | Tooling, dependencies, CI | `chore/update-nest`     |

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`
- Scopes: `web`, `api`, `shared`, `config`, `db`, `docs`, `ci`
- Imperative mood, lower case, no trailing full stop, summary under 72 characters.
- Explain _why_ in the body when it is not obvious from the diff.

```
feat(api): add health endpoint with live database probe
fix(web): keep mobile drawer focus on the menu button after Escape
```

Keep commits focused: one logical change each, with its tests.

## Before opening a pull request

Run, from the repository root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration   # needs TEST_DATABASE_URL
pnpm build
pnpm test:e2e           # needs a Playwright browser
```

CI runs the same sequence. A pull request should state what changed and why, how it was verified,
and any follow-up work. Changes to behaviour need tests; changes to setup need documentation.

## Database changes

- Edit the Drizzle schema in `apps/api/src/database/schema/`, then run `pnpm db:generate`.
- Review the generated SQL before committing it. Commit the migration **and** the `drizzle/meta`
  files together.
- Never edit a migration that has been applied anywhere shared; add a new one.
- Migrations are applied with `pnpm db:migrate`, never automatically on API start-up.

## Interface rules

- Use the tokens in `apps/web/src/styles/tokens.css`; do not hard-code colours. The token test
  checks WCAG contrast for every text/background pair.
- Server Components by default; add `'use client'` only where interaction requires it.
- Every interactive element needs visible focus, keyboard access and an accessible name.
- No icon libraries; add icons to `apps/web/src/components/icons`.
- Meaning must never depend on colour alone: pair status colours with text.
