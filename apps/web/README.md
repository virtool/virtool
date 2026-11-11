# @virtool/web

The Virtool web app, published as `ghcr.io/virtool/web`; see
[Images](../../README.md#images). It listens on port 9900. Run it locally with
`vtd`; see [the development guide](../../dev/README.md).

## Key libraries

- **TanStack Router and Start** for routing, SSR, and server functions
- **React Query** for server state and **zustand** for client state
- **Tailwind CSS**, **Radix UI**, and **CVA** for styling
- **d3** for imperative SVG charts
- **Better Auth** with its passkey plugin for human authentication

## Configuration

The server validates its variables before it starts to listen. Every runtime
variable accepts a `_FILE` variant, which takes precedence. See
[the environment guide](../../docs/env.md) for file-backed values and key
rotation. Configure the required storage backend with
[the shared storage settings](../../docs/storage.md#configuration).
The table below covers the remaining settings and web-specific storage behavior.

| Variable                         | Type                     | Default  | Use                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VT_POSTGRES_URL`                | URL                      | Required | Connect to the Virtool Postgres database.                                                                                                                                                                                                                                         |
| `VT_POSTGRES_POOL_MAX`           | Positive integer         | `10`     | Limit the Postgres connection pool.                                                                                                                                                                                                                                               |
| `VT_PUBLIC_ORIGIN`               | URL origin               | Required | Public browser origin for authentication and WebAuthn, including behind a proxy. Use an HTTPS hostname (HTTP is allowed for localhost), with no path, query, fragment, or credentials.                                                                                            |
| `VT_AUTH_SECRET`                 | String (32+ characters)  | Required | Sign and encrypt the authentication state Better Auth issues, including stored recovery codes. Generate with `openssl rand -base64 32`. Changing it invalidates every Better Auth session.                                                                                        |
| `VT_METRICS_TOKEN`               | String                   | Unset    | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404.                                                                                                                                                                               |
| `VT_SENTRY_DSN`                  | URL string               | Unset    | Send server and browser errors to Sentry. The server gives this value to the browser at runtime.                                                                                                                                                                                  |
| `VT_ENCRYPTION_KEY`              | Base64 string (32 bytes) | Unset    | Encrypt values stored by Virtool: the Resend API key, the NCBI API key, and email links. When unset or invalid, email is unavailable and GenBank lookups drop to the anonymous rate limit, but the server runs. See [the encryption-key guide](../../docs/env.md#encryption-key). |
| `VT_ENCRYPTION_KEY_PREVIOUS`     | Base64 string (32 bytes) | Unset    | Accept encrypted values written under the prior key during rotation.                                                                                                                                                                                                              |
| `VT_STORAGE_AZURE_DOWNLOAD_URL`  | URL origin               | Unset    | Rehost redirected Azure downloads on a public origin, such as `https://files.virtool.ca`. Applies to `redirect` download mode, and to uploads when `VT_STORAGE_AZURE_UPLOAD_URL` is unset.                                                                                        |
| `VT_STORAGE_AZURE_UPLOAD_URL`    | URL origin               | Unset    | Rehost presigned Azure uploads on a public origin, such as a Front Door route to a private storage account. Falls back to `VT_STORAGE_AZURE_DOWNLOAD_URL`, then the Azure Blob endpoint.                                                                                          |
| `VT_STORAGE_DOWNLOAD_MODE`       | `stream` \| `redirect`   | `stream` | Serve file downloads by streaming the bytes through this server, or by 302-redirecting to a short-lived presigned storage URL. `redirect` falls back to streaming when the backend can't presign.                                                                                 |
| `VT_UPLOADS_CHUNKED`             | `1`, `true`, or `yes`    | `false`  | Enable direct Azure Block Blob uploads. When off, or when the backend can't presign uploads, initialization returns 503; there is no proxied fallback.                                                                                                                            |
| `VT_UPLOADS_CHUNKED_CONCURRENCY` | Positive integer         | `8`      | Set how many block PUTs a browser runs at once across all active uploads. Raise it to lift throughput on a high-latency upload path.                                                                                                                                              |

## Metrics

`GET /metrics` shares the app's listener on port 9900. Set `VT_METRICS_TOKEN`
and send `Authorization: Bearer <token>` to scrape it. Without a configured
token the endpoint returns 404. Invalid credentials return 401.

```yaml
scrape_configs:
  - job_name: virtool-web
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials: <VT_METRICS_TOKEN>
    static_configs:
      - targets: ["virtool-web:9900"]
```

The app emits `virtool_*` series for requests, the build, the Postgres pool, and
account lifecycle operations, and standard process metrics. Request latency
measures the time to response headers, also for streams. Pool gauges count this
replica's database connections, not queries that wait for a pool slot. A failed
pool probe keeps the previous values, and the rest of the scrape stays
available. See [the metrics guide](../../docs/metrics.md) to query across
services.

## Gateways and rollouts

Gateways must forward `Origin` and the fetch-metadata headers. Mutating browser
requests must be same-origin, and API keys are exempt. Check gateway body limits
when you change a request shape.

A Postgres outage answers 503, and the client shows an unavailable state that
retries.

If a server function changes its HTTP method, old browser tabs receive 405. Keep
them on a matching server version or require a reload during the cutover.

Browsers get the **What's new** posts and their images from
`https://www.virtool.ca`. The content security policy allows that origin. If a
network blocks it, the list is empty and the rest of the app works.

## Authentication

Better Auth authenticates interactive users. Virtool owns account state, API
keys, and authorization. Users sign in with a handle, not an email address,
because `users.email` isn't globally unique. Inactive and pending users get the
same 401 as bad credentials.

Server functions accept browser sessions only. Raw routes, such as uploads,
downloads, and server push, also accept API keys. A valid API key wins over a
session cookie. Any other `Authorization` header falls back to the cookie,
because a reverse proxy that uses HTTP Basic forwards its own credentials on
every browser request.

New passwords use Argon2id, and legacy bcrypt hashes still verify. After a
successful sign-in, Virtool replaces an outdated hash. Users don't have to reset
their passwords. If the replacement fails, Virtool logs the failure and the
sign-in continues.

### Rate limits

Budgets are shared across web instances. A refused request gets a 429.

| Action                                      | Limit            |
| ------------------------------------------- | ---------------- |
| Password sign-in, per client IP             | 3 in 10 seconds  |
| Password sign-in, per handle                | 10 in 15 minutes |
| Password sign-in, per known browser         | 5 in 15 minutes  |
| Passkey sign-in, per client IP              | 3 in 10 seconds  |
| Passkey challenges, per client IP           | 10 in 60 seconds |
| Recent authentication, per client IP        | 5 in 1 minute    |
| Recent passkey options, per client IP       | 5 in 1 minute    |
| Recent authentication failures, per account | 10 in 15 minutes |
| Password recovery, per requester            | 5 in 1 minute    |
| Password recovery, per target account       | 3 in 1 hour      |

A correct password resets the handle budget, so only failures accumulate. It also
gives the browser a `login_device` cookie for 30 days. That browser then spends
its own budget, so failures from other browsers can't lock the owner out. A
password change invalidates these devices.

A failed password or authenticator code at a recent-authentication challenge
spends the account budget. A correct one gives it back, and a passkey works
while the budget is spent. An authenticator code that a challenge already
accepted is refused for two minutes.

The hourly internal cleanup task prunes the budgets. The web server doesn't.

### Sessions

Browser sessions last seven days and roll forward with use, with no absolute
limit. The authenticated shell refreshes the session when it mounts and when the
window regains focus. No other traffic extends a session, so an unattended tab
can't keep itself signed in.

Sensitive actions need a sign-in, or a new password, TOTP, or passkey challenge,
in the last 15 minutes. Examples are handle, password, and email changes, API key changes,
and administrator changes to users and policy. A stale call returns 403 with the
code `SESSION_NOT_FRESH`. API keys and restricted credentials can't satisfy this
requirement. Sign-out and revocation of the current session never need it.

Users can list and revoke their other sessions. Revocation takes effect on the
next request and on the next server-push recheck. A lost session returns the user
to sign-in with the message "Your session ended." Network and server errors never
end a session.

### Accounts

Administrators create accounts by email invitation. The invitee chooses a handle
and password. Only a full administrator can preassign an administrator role. A
new link always replaces older links, and a copyable link appears only once.

The first user at `/setup` becomes the first full administrator. Bootstrap
doesn't need email delivery.

An email change keeps the current address until the new mailbox proves control.
Links are single use and rate limited. A change supersedes outstanding recovery
links, and the existing browser session stays active.

Public password recovery always gives the same acknowledgement. Only an eligible
account with a verified email gets a link, and a link less than an hour old stays
in place. An administrator with recent authentication can issue a one-time
recovery URL, also when email delivery is unavailable. A recovery link changes
the password and ends all of the user's sessions.

### Restricted accounts

Some accounts can complete only one setup step before they reach the
application. An active legacy account with no usable unique email must add an
address at the wall. A legacy password never starts an ordinary session, and a
user in this state who forgets the password needs an administrator recovery link.

With email delivery on, only the emailed link verifies the address. The link
expires after 72 hours. With delivery off, setup completes immediately and the
address stays unverified.

The credential is a separate cookie pair. It can't reach raw routes or API keys.

### The wall

The wall is the set of routes that a browser without an ordinary session can
open:

| Route                                             | Job                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `/login`                                          | Password, passkey, and TOTP or recovery-code sign-in                  |
| `/setup`                                          | First-instance bootstrap. It redirects to `/login` when a user exists |
| `/account-setup`                                  | Invitation acceptance from a `#token=` link                           |
| `/recover`                                        | Recovery request and recovery-link consumption                        |
| `/verify-email`                                   | Email verification links                                              |
| `/email-remediation`, `/email-remediation-verify` | Legacy email remediation                                              |
| `/mfa-enrollment`                                 | TOTP enrollment under the `required` MFA policy                       |

### Two-factor authentication

Users enroll in TOTP on `/account/security`. Enrollment shows the secret one time
and makes ten recovery codes. Trusted devices are off.

The login challenge allows five attempts. Ten failures lock the factor for 15
minutes.

A full administrator with recent authentication sets the MFA policy to `optional`
or `required` on the **Administration › Security** page. Virtool refuses
`required` until that administrator has confirmed TOTP or added a passkey. The
policy applies to live sessions immediately: a user with no confirmed TOTP and no
passkey can reach only `/mfa-enrollment`, which enrolls TOTP only. A user without
a passkey who turns off TOTP, or a user without TOTP who removes their last
passkey, goes back to `/mfa-enrollment`. API keys are never challenged or
restricted.

A full administrator with recent authentication can reset the TOTP of a user who
has lost both the authenticator and the recovery codes, but not their own. The
reset ends the user's sessions. Under `required`, a user without a passkey must
then enroll TOTP again.

An administrator with recent authentication can revoke the access of a
compromised account, but not their own. A target that is an administrator needs
the `full` role. In one transaction, revocation removes the user's sessions, API
keys, passkeys, TOTP enrollment, recovery codes, and outstanding links, and
replaces the password with a hash of a secret nobody keeps. It also marks the
email unverified, because an attacker may have changed it. This closes
self-service recovery and makes administrator links copy only. The user gets no
email. An administrator gives the user a recovery link through a trusted channel.

### Passkeys

A passkey is an optional primary credential. The password stays available for
sign-in and recovery. A passkey sign-in passes the same account checks as a
password sign-in, and it requires user verification, such as a PIN or biometric.
A user enrolled in TOTP therefore gets no second challenge after a passkey, and
a passkey satisfies the `required` MFA policy.

Users can remove their final passkey, because the password remains. Removal
doesn't change the password, TOTP, recovery codes, API keys, or sessions.

The Relying Party comes from `VT_PUBLIC_ORIGIN`. A response signed for another
origin is refused. See [the environment guide](../../docs/env.md).

## Uploads and downloads

Uploads go directly to Azure Block Blob storage. File bytes never pass through
the web server, and there is no proxied upload. API clients follow
[the upload API guide](https://www.virtool.ca/docs/api/uploads).

When direct uploads are off, or the storage backend can't issue an upload SAS,
initialization returns 503.

`settings.max_upload_size` limits browser and API uploads. A declared size above
the limit returns 413, and changes apply to the next upload without a restart.
The application ceiling is 120,000,000,000 bytes (120 GB).

## Server push

The authenticated `/events` stream tells browsers which records changed. The
browser then refetches through the normal API, so authorization stays at the
request boundary.

## Development

Conventions with no single home in code follow. Follow
[AGENTS.md](../../AGENTS.md) for repository-wide rules.

### Client

- Use specific path aliases across directories, and keep `@/*` for routes and
  types.
- Route loaders, guards, and search validators are eager exports. Import feature
  query modules dynamically inside loaders, and keep queries needed before
  sign-in in small, separate modules.
- Keep query options, hooks, and mutations in each feature's `queries.ts`, and
  don't add an `api.ts`.
- Primary route data uses suspense queries, prefetched in the loader. Secondary
  data uses `useQuery`. Only suspense queries and loader prefetches run during
  SSR.
- Put invalidation in `useMutation` callbacks, and put navigation and toasts in
  `mutate` callbacks.
- Resolve search defaults in `validateSearch`, and strip them from URLs with
  `stripSearchParams`.
- Give `<title>` one string child, also inside SVG. Turn off SSR only at the
  route that needs it, because descendants can't turn it on again.
- For React Compiler, don't spread a `react-hook-form` methods object, and sync
  form props with `useForm({ values })`.
- Reuse base components, and extract a component to `@base` when a second feature
  needs it. Use theme tokens, not arbitrary utilities or hard-coded colors. Size
  text containers in `rem`.

### Server

- Inject data dependencies in the order `db`, `storage`, `logger`.
- Keep policy logic in framework-free functions, so unit tests don't load
  environment configuration or open a database.
- Use explicit `POST` for free-text searches, structured filters, and batch reads,
  so their inputs stay out of URLs. Use explicit `GET` for simple lookups and
  small bounded filters.
- Export explicitly nameable types when inference would expose a transitive
  dependency.

### Testing

Tests run in three Vitest projects: `web` (jsdom), `server` (Node and Postgres),
and `a11y` (Chromium). Run them all with `pnpm --filter @virtool/web test`, or
select one with `pnpm --filter @virtool/web exec vitest run --project <name>`.
Install Chromium with `pnpm --filter @virtool/web exec playwright install chromium`.

Put tests in adjacent `__tests__/` directories. Use `user-event` and accessible
queries, and don't disambiguate controls by index. Local tests skip React
Compiler. CI enables it with `VT_TEST_REACT_COMPILER=1`.
