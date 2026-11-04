# Email

The API sends four kinds of message through a small provider abstraction. **No paid service is
required**, and by default nothing is sent.

## Providers (`EMAIL_PROVIDER`)

| Value          | Behaviour                                                                                                                                  | Use for                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| unset / `none` | Sends nothing. Callers are told the message was not sent, and the web app says so (for example "No email was sent") instead of pretending. | A fresh install; tests             |
| `dev-capture`  | Keeps messages in memory and serves them at `GET /api/v1/dev/mailbox` (and `DELETE` to clear).                                             | Local development, automated tests |
| `smtp`         | Sends through any SMTP server using `nodemailer`.                                                                                          | A real deployment                  |

`dev-capture` is **refused at start-up when `NODE_ENV=production`**, because it exposes message
contents over HTTP. With any other provider the `dev/mailbox` routes answer 404, and the web
gateway never forwards `dev/` paths.

## SMTP settings

| Variable                     | Notes                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `EMAIL_FROM`                 | Sender, for example `SmartPack <no-reply@your-company.example>`. Required for `smtp`.                                           |
| `SMTP_HOST`, `SMTP_PORT`     | Required for `smtp`.                                                                                                            |
| `SMTP_SECURE`                | `true` for implicit TLS (usually port 465). Otherwise STARTTLS is **required** for any host other than `localhost`/`127.0.0.1`. |
| `SMTP_USER`, `SMTP_PASSWORD` | Set together or not at all. Secrets: keep them in the host's secret store, never in Git.                                        |
| `WEB_APP_URL`                | Origin used in every link, for example `https://smartpack.your-company.example`. Required in production, must be `https`.       |

Costs depend on the SMTP service you choose. Many companies already have one through their
Microsoft 365 or Google Workspace plan, and many transactional services have free tiers; none is
needed to run Phase 3. Nothing is signed up for or configured by this project.

## Messages

| Template             | Sent when                                                                                                      | Link                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `invitation`         | An invitation is created or resent                                                                             | `WEB_APP_URL/accept-invitation#token=...` (72 hours) |
| `password_reset`     | A reset is requested for an existing account                                                                   | `WEB_APP_URL/reset-password#token=...` (60 minutes)  |
| `email_verification` | A person asks to verify their address                                                                          | `WEB_APP_URL/verify-email#token=...` (24 hours)      |
| `password_changed`   | **Defined but not sent in Phase 3.** A notice after a password change is listed in [DEFERRED.md](DEFERRED.md). | none                                                 |

Each message has a plain-text and an HTML version. The HTML escapes everything it interpolates, and
the link is repeated as text so it still works if a mail client breaks the button. Tokens are placed
in the URL **fragment** so they are not sent to any web server and do not reach access logs or
`Referer` headers.

## Delivery truthfulness and logging

- `EmailService.send` reports `sent` only when the provider accepted the message, `failed` when it
  refused or errored, and `not_configured` when there is no provider. It never throws into the
  request and never holds a database transaction open.
- Public endpoints (password reset request) send in the background so the response time and body do
  not depend on whether an account exists or whether delivery worked.
- Every attempt with a provider is recorded in `email_deliveries` (template, recipient, status,
  provider, a message id or a short error with anything that looks like a credential redacted). The
  body and the link are never stored or logged.

## Trying it locally

```powershell
# in apps/api/.env
EMAIL_PROVIDER=dev-capture
WEB_APP_URL=http://localhost:3000
```

Invite someone, then read the link: `Invoke-RestMethod http://127.0.0.1:4000/api/v1/dev/mailbox`
(the newest message is first).
