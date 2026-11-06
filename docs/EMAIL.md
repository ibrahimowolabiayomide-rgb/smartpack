# Email

The API sends its messages through a small provider abstraction. **Nothing is sent unless a provider
is chosen**; Brevo's free tier is enough to start with.

## Providers (`EMAIL_PROVIDER`)

| Value          | Behaviour                                                                                                                                  | Use for                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| unset / `none` | Sends nothing. Callers are told the message was not sent, and the web app says so (for example "No email was sent") instead of pretending. | A fresh install; tests             |
| `dev-capture`  | Keeps messages in memory and serves them at `GET /api/v1/dev/mailbox` (and `DELETE` to clear).                                             | Local development, automated tests |
| `smtp`         | Sends through any SMTP server using `nodemailer`.                                                                                          | A real deployment                  |
| `brevo`        | Sends through Brevo's transactional HTTP API (`POST /v3/smtp/email`).                                                                      | A real deployment (recommended)    |

`dev-capture` is **refused at start-up when `NODE_ENV=production`**, because it exposes message
contents over HTTP. With any other provider the `dev/mailbox` routes answer 404, and the web
gateway never forwards `dev/` paths.

## Brevo settings (`EMAIL_PROVIDER=brevo`)

| Variable             | Notes                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `BREVO_API_KEY`      | Required. Secret; set it in the host's environment (Render), never in Git or logs.     |
| `EMAIL_SENDER_EMAIL` | Required. Must be a verified sender in Brevo (Brevo emails a 6-digit code to confirm). |
| `EMAIL_SENDER_NAME`  | Optional, default `SmartPack`. Change the sender later by editing these two variables. |
| `WEB_APP_URL`        | As below: the origin used in every link.                                               |

Behaviour: one HTTPS request per message with a 10 second timeout, no redirects (the key never
follows one) and **no automatic retries** (a retry after a timeout could deliver twice). `sent`
means Brevo answered 2xx. A refusal (bad key, unverified sender, rate limit, outage) is recorded as
`failed` with a short reason such as `Brevo refused the message (HTTP 401). The API key was rejected;
check BREVO_API_KEY.` The key is redacted from every error before it is logged or stored.

**Deliverability:** a free-mail sender such as a `gmail.com` address cannot be domain-authenticated
(SPF/DKIM/DMARC), and Gmail and Yahoo require authenticated sender domains for bulk and transactional
mail, so messages may be delayed, filtered to spam or rejected. For reliable delivery, authenticate a
domain you own in Brevo and use an address on it.

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

| Template             | Sent when                                                      | Link                                                 |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `invitation`         | An invitation is created or resent                             | `WEB_APP_URL/accept-invitation#token=...` (72 hours) |
| `password_reset`     | A reset is requested for an existing account                   | `WEB_APP_URL/reset-password#token=...` (60 minutes)  |
| `email_verification` | A person asks to verify their address                          | `WEB_APP_URL/verify-email#token=...` (24 hours)      |
| `password_changed`   | After a password is changed or reset (sent in the background). | none                                                 |

### Message content

Each message is written for its own purpose (`apps/api/src/email/templates.ts`) and shares only the
SmartPack frame (`layout.ts`): header, details panel, button, security notice, closing and footer.

- **Invitations are role-specific.** `invitation-roles.ts` holds the wording for each of the seven
  built-in roles (Company Owner, Company Administrator, Operations Manager, Asset Manager,
  Supervisor, Worker, Auditor). Every statement about what a role can do is a plain-language reading
  of `packages/shared/src/permissions.ts`; `templates.spec.ts` asserts those permission facts, so a
  permission change fails a test and the copy must be reviewed.
- **A resend is its own message**: it says the invitation is being sent again, keeps the company and
  role, and explains that the earlier link no longer works and the deadline has been extended.
- **Expiry text is the configured lifetime** (`INVITATION_TTL_HOURS`, `PASSWORD_RESET_TTL_MINUTES`,
  `EMAIL_VERIFICATION_TTL_HOURS`), for example "72 hours (3 days)" or "60 minutes (1 hour)".
- **Names and addresses** come from the real account (first name, email, company, inviter). An
  invitation has no recipient name because none exists yet, so it opens with "Hello,".
- The footer links to the web application's own origin (`WEB_APP_URL`); no postal address, telephone
  number or support address is invented.

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
