# Frontend and backend communication

The browser never calls the API. Server components in the web app call it with `apiGet`
(`apps/web/src/lib/api/client.ts`) and render the result.

```
Browser ──► Next.js server component ──apiGet──► NestJS API ──► PostgreSQL + PostGIS
```

## The client

`apiGet(path, dataSchema, options)`:

- builds the URL from `API_URL` (see `base-url.ts`); in development it defaults to
  `http://127.0.0.1:4000/api/v1`, elsewhere a missing value is an `unconfigured` result;
- sends `x-request-id` (a fresh UUID) so a failure can be matched to an API log line;
- uses `cache: 'no-store'` and a timeout (default 4 seconds);
- parses the API envelope and validates `data` against the shared Zod schema;
- never throws. It returns one of:

| Result             | Meaning                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `ok`               | A valid response in an accepted status                                 |
| `unconfigured`     | `API_URL` is not set outside development                               |
| `unreachable`      | The request timed out or the network failed (reason is recorded)       |
| `http-error`       | The API answered with an error; its error envelope and request id kept |
| `invalid-response` | The body did not match the contract                                    |

## What uses it today

Only the health endpoint, `GET /api/v1/health`, because it is the only endpoint that exists. It
returns 200 with a report when healthy and 503 with a report when the database or PostGIS is
unavailable; both are accepted and shown honestly ("All systems operational", "Database
unavailable"). The Overview page, the Help page diagnostics and the diagnostics dialog use it.
Health appears as **system status only**: it is not presented as business data.

Failure states shown to the user, each with a "Check again" action and the request id where one
exists: API address not configured, API unreachable (timeout or network), API error response,
invalid response, database unavailable.

## Adding an endpoint in a later phase

1. Define the request and response schemas in `packages/shared`.
2. Implement and test the API endpoint.
3. Call it from a server component with `apiGet(path, schema)`.
4. Render each result kind; do not treat anything but `ok` as success.
5. Promote the module in `lib/modules.ts` only when the page works end to end.
