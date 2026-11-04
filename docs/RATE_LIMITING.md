# Rate limiting

Rate limits slow down guessing and abuse of the endpoints that need no session. They are enforced by
the API with an in-process sliding window: no Redis or any other extra service.

## Limits

Counts are per client address unless another key is named. `429 RATE_LIMITED` is returned with a
`Retry-After` header (seconds) and the usual error envelope. `RATE_LIMIT_SCALE` multiplies every
allowance (for example `2` doubles them).

| Policy                   | Applies to                                     | Limit | Window     |
| ------------------------ | ---------------------------------------------- | ----- | ---------- |
| `login-ip`               | Any sign-in attempt from one address           | 40    | 15 minutes |
| `login-fail-account-ip`  | **Failed** sign-ins, one account + one address | 5     | 15 minutes |
| `login-fail-account`     | **Failed** sign-ins, one account, any address  | 25    | 1 hour     |
| `password-forgot-ip`     | Reset requests                                 | 10    | 15 minutes |
| `password-forgot-email`  | Reset requests for one address                 | 3     | 1 hour     |
| `password-reset-ip`      | Reset attempts with a token                    | 10    | 15 minutes |
| `password-change-user`   | Password changes by one signed-in person       | 10    | 15 minutes |
| `email-verify-ip`        | Verification attempts                          | 20    | 15 minutes |
| `email-resend-user`      | Verification emails requested by one person    | 3     | 1 hour     |
| `invitation-token-ip`    | Invitation preview and accept                  | 20    | 15 minutes |
| `invitation-accept-fail` | Failed acceptances, one email + one address    | 5     | 15 minutes |
| `invitation-send-user`   | Invitations sent by one person                 | 30    | 1 hour     |

Why these shapes: the per-address sign-in allowance is generous because an office shares one public
address. Only **failed** sign-ins count toward the two account limits, so ordinary use never
approaches them.

Consequences you should know about:

- Once an account has used up either failure limit, further sign-in attempts for it are refused with
  `429` **before the password is checked**, so even the correct password is refused until the window
  passes (the 15-minute limit applies to one address; the 25-per-hour limit applies to everyone).
- That means someone who knows an address can deliberately make 25 failed attempts and keep the
  real person out for up to an hour. It is the usual trade-off of account-based throttling, chosen
  here over unlimited guessing. Owners can still use **Forgot your password**, which has its own
  limits and signs nothing in by itself.
- A blocked attempt (`429`) is not written to the audit log; the failed attempts that caused the
  block are (`auth.login.failed`).

## How it is counted

Each limit is counted either by the route's `@RateLimit(...)` decorator or inside the service, never
both (an earlier version counted forgot-password and reset twice; that was fixed and is tested).

## Known limits of this design

- **Per process.** Counters live in the memory of one API process and reset when it restarts. With
  several API instances each keeps its own counters, so the effective allowance is multiplied by the
  instance count. For the first deployment (one instance) this is exact. A shared store would fix it
  but adds a service and a cost, so it is a decision to take when the API is scaled out
  ([DEFERRED.md](DEFERRED.md)).
- **Client address depends on the proxy setting.** Behind a reverse proxy or a hosting platform the
  API sees the proxy's address unless `TRUST_PROXY_HOPS` is set to the number of proxies in front of
  it (usually `1`). Too low and everyone shares one counter; too high and a client can fake its
  address with a header. The web application's gateway forwards the real client address in
  `X-Forwarded-For`, so **with the web app in front of the API, set `TRUST_PROXY_HOPS=1`** (more if
  your platform adds another hop) and confirm it as described in [DEPLOYMENT.md](DEPLOYMENT.md).
- **Memory is bounded**: each key keeps at most `limit` timestamps, expired keys are swept every
  minute, and the total key count is capped at 100,000.
- **Disabled for the browser tests only.** `RATE_LIMIT_DISABLED=true` exists so end-to-end tests,
  which share one address, do not trip limits. The setting is **refused in production**. The limits
  themselves are verified by the API integration tests (`security.integration.spec.ts`).
