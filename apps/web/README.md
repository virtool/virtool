# @virtool/web

The Virtool web app. The root Dockerfile's `dist`
target is published as `ghcr.io/virtool/web`; see [CI](../../docs/ci.md#images).

Follow [AGENTS.md](../../AGENTS.md) for repository-wide rules and checks, and
[the development guide](../../dev/README.md) to run the app with `vtd`.

## Key libraries

- **React** with React Compiler for rendering
- **TanStack Router and Start** for routing, SSR, and server functions
- **React Query** for server state; **zustand** for client state
- **react-hook-form** and **zod** for forms and validation
- **Tailwind CSS**, **Radix UI**, and **CVA** for styling and component variants
- **Lucide React** for icons
- **d3** for imperative SVG charts
- **exceljs** for server-side analysis XLSX exports
- **Better Auth** with its passkey plugin for human authentication

## Client development

### Imports and bundles

Use specific path aliases across directories; reserve `@/*` for `src/routes`
and `src/types`. [tsconfig.json](tsconfig.json) defines the aliases. Follow the
server-import restrictions in [AGENTS.md](../../AGENTS.md#client).

Route loaders, guards, and search validators are eager exports. Dynamically
import feature query modules inside loaders so their request dependencies do
not enter every page's initial bundle. Keep queries needed before sign-in in
small, separate modules, even when imported dynamically: the login page still
loads everything its guards need.

Use the dependency-free helpers in [searchParams.ts](src/app/searchParams.ts)
for synchronous search validation. Keep utilities with heavy dependencies in
separate modules so importing a lightweight helper doesn't load them too.

Code reachable through `start.ts` belongs to the browser graph as well. Follow
[auth middleware](src/server/auth/middleware.ts) when a shared entry needs
server-only code: use `createServerOnlyFn` with a dynamic import. Native
packages also need to survive both bundling stages; the externalization and
tracing constraints live beside their settings in [vite.config.js](vite.config.js).

### Rendering

Follow the render-purity rules in [AGENTS.md](../../AGENTS.md#client). Use
`@app/serverNow` for elapsed time, `useHydrated` for viewer-local absolute times,
and `ClientOnly` for measured subtrees. Give `<title>` one string child,
including inside SVG. Turn off SSR only at the route that needs it; descendants
can't re-enable it.

For React Compiler compatibility, don't spread a `react-hook-form` methods
object, sync form props with `useForm({ values })`, and use
`@app/useMatchPartialPath` instead of `useMatchRoute`.

### Routing and data

Use Router `<Link>` and its `search` prop for internal navigation. Resolve
search defaults in `validateSearch`, strip them from URLs with
`stripSearchParams`, and use `@app/pagination` for paginated routes.

Call TanStack Start server functions through React Query. Keep query options,
hooks, mutations, and inline server-function calls in each feature's
`queries.ts`; don't add a separate `api.ts`. Build keys with `createQueryKeys`
in a separate `keys.ts` and import them directly. This lets invalidators use
keys without loading the request layer.

Declare reusable keys and fetchers together with `queryOptions`. Prefetch data
needed for the first render with `ensureQueryData` in a route loader. Fetch
interaction-only data at its point of use.

Primary route data uses suspense queries. Route boundaries handle pending and
error states. Preserve `notFound()` mappings where a route has a
specific not-found view. Only suspense queries and loader prefetches run during
SSR; plain `useQuery` starts after hydration.

Secondary data uses `useQuery`. Check `isError && !data` and render `QueryError`
before checking `isPending`, keeping stale data visible after a failed refetch.
Don't treat missing data as loading: an initial error has no data either.
Paginated queries use `placeholderData: keepPreviousData`. Read server-function
error statuses with `getErrorStatus` from `@app/queryErrors`.

Put invalidation in `useMutation` callbacks so it runs even after the component
unmounts. Put navigation, toasts, and other view effects in `mutate` callbacks.
Invalidate the narrowest hierarchical key; reserve `setQueryData` for frequent
updates where repeated requests are too expensive.

### Styling

Read `src/base` before building UI. Reuse its accessibility and interaction
behavior; if another feature already has the missing component, extract it to
`@base` for both consumers.

Use Tailwind utilities and `cn()` from `@app/cn`. Reuse or add tokens in
[src/app/style.css](src/app/style.css) and
[animations.css](src/app/animations.css), avoiding arbitrary utilities and
hard-coded colors. Base component colors use the shared `PaletteColor`.

Size text containers in `rem`; reserve pixels for graphics without text. When
an API requires a numeric size, resolve a rem value with `useRootFontSize` from
`@app/hooks`.

## Server development

### Layers and boundaries

Follow the server layering and wire contracts in
[AGENTS.md](../../AGENTS.md#server). Web server functions get dependencies
from `@server/composition` and build validators from `@server/validation`.
Inject data dependencies in the order `db`, `storage`, `logger`.

Keep policy logic in framework-free functions so unit tests can import it
without loading environment configuration or opening a database. Server code
must not import the browser feature tree. Export explicitly nameable types
when inference would expose a transitive dependency.

Shape results in `functions.ts`, without repeating that parsing in React Query
`select` callbacks. Use `JsonObject` or `JsonValue` for opaque JSON results.

GenBank OTU drafts require a resolved NCBI species taxon and consistent named
isolate, strain, or clone identity across records. Anonymous records can join a
named record. Multipartite plans require unique named segments; GenBank segment
names are normalized, and unnamed records must match a single segment by length.
Adding an isolate from GenBank requires its species to match the OTU lineage.
GenBank `CreateOTU` and `CreateIsolate` requests carry accession-to-sequence provenance; the server
resolves those accessions again at save time and checks taxonomy, sequence
content, and segment assignment before applying the versioned command. Manual
`CreateOTU` and `CreateIsolate` requests have no GenBank provenance. Both
manual and GenBank isolates must satisfy the OTU plan when saved.
Manual OTU creation accepts one or more segments. Multipartite segments have
unique names, rules, expected lengths, and tolerances; the first isolate
supplies one sequence assigned to each segment. The same plan validation runs
before submission and at the server boundary.
Local OTU taxonomy name, acronym, and lineage can be edited at the OTU's
current version. The edit creates a new local identity revision without changing
maintenance ownership or sequence provenance. Curators may add an NCBI species
taxon to a manual OTU's lineage so GenBank isolates can pass species matching.
Taxonomy history summarizes the new name and omits sequence bodies.
Local OTU molecule and segment plans can be edited at the OTU's current
version. The editor previews every surviving isolate against the proposed
plan, clears the preview after any input change, and requires confirmation.
The server checks all isolates again in the save transaction and rejects a
plan that invalidates any of them. Plan edits retain sequence provenance and
record a semantic history entry without sequence bodies.
Curators can also edit an isolate's name and name type, or clear its name.
This advances the OTU version and records semantic history while keeping its
sequences and their provenance unchanged.
Creating a GenBank OTU first resolves accessions into a preview of its taxonomy,
molecule, isolate, and segments. Changing accessions clears that preview; creation
requires a separate confirmation, and the server checks the records again then.
An OTU can use an accession base only once among its current sequences, even
when submitted GenBank versions differ. Deleting an isolate releases its
accessions for re-import. Sequence details expose their source and exact
GenBank accession version.

Local v2 Reference settings allow members with `modify` rights to edit name,
description, and the default segment length tolerance. Each edit carries the
Reference version shown in the form; stale versions and archived References
reject the edit. Archiving and unarchiving advance the version too.

### Error handling and request methods

Map expected domain failures in one module-local
`rethrowAsHttp(err: unknown): never` per `functions.ts`. Each expected 4xx branch
sets the response status and throws `ClientError` with the same status. Throw
unknown failures unchanged, preserving upstream error reporting. See
[errors.ts](src/server/errors.ts) for why setting the HTTP status alone is
insufficient. Local error mappers don't need `createServerOnlyFn` wrappers.

Server functions serialize an RPC body, so don't return 204, 205, or 304; return
`null` with 200 for deletion.

Use explicit `POST` for free-text searches, structured filters, and batch reads,
keeping their inputs out of URLs. Use explicit `GET` for simple ID lookups,
no-input reads, and small bounded filters. Read calls remain React Query
queries regardless of method. Bound inputs and enforce body limits before
parsing.

RPC method changes require a coordinated browser/server rollout: old tabs
calling a changed method receive 405. Keep them on a matching server version or
require a reload during cutover. Check gateway body limits and forwarding of
origin and fetch-metadata headers when changing these request shapes.

### Authorization and raw routes

Every exported server function declares exactly one policy from
`@server/auth/policy`: `open()`, `authenticated()`, `adminRole(role)`,
`permission(name)`, `recentlyAuthenticated(operation)`, `setupOnly(purpose)`,
or `passwordResetOnly()`. Read the
discriminated principal from `context.principal` and do not perform a second
lookup. Browser sessions, API keys, setup sessions, and forced-reset sessions
have distinct principal kinds so a policy cannot silently widen one credential
into another. Row-dependent authorization remains in the handler. Register
each new `functions.ts` module in
[src/server/__tests__/authorization.test.ts](src/server/__tests__/authorization.test.ts).
Keep `createServerFn` at the definition site so the compiler recognizes it.

Restricted setup credentials may complete only their named transition. Each
`setupOnly` function must also appear with the matching purpose in
[setupExceptions.ts](src/server/auth/setupExceptions.ts).

Raw routes handle transports RPC can't provide, such as uploads, streaming
downloads, SSE, probes, metrics, and `/api/auth/*`. They enforce their own
authorization. `requireAuthenticatedRequest` accepts sessions and API keys;
server functions are session-only. Better Auth owns sign-in, while Virtool owns
account state and authorization; see [betterAuth.ts](src/server/auth/betterAuth.ts).

Better Auth is mounted at `/api/auth/$` and composed in
`@server/auth/betterAuth`. It authenticates interactive users; Virtool still
owns account state, API keys, and authorization. Its raw handler is outside the
server-function authentication and CSRF middleware, so Better Auth performs its
own origin check against `VT_PUBLIC_ORIGIN`.

Recent-authentication challenges pass through Better Auth's HTTP handler at
`/api/auth/virtool-session/challenge`. Password and TOTP share a limit of five
attempts per minute per IP. Better Auth stores rate limits in `auth_rate_limits`
so all web instances share the budget. Direct `auth.api` calls bypass this
limiter; challenge verification must enter through the handler.

Virtool rejects inactive and pending users with the same 401 as bad credentials.
A user with `force_reset` receives a session that resolves to a
`password_reset` principal, which can only inspect or end its session and
replace the password. Virtool signs in by handle; email sign-in is off because
`users.email` isn't globally unique.

Better Auth's `auth_*` tables use integer identity keys so `users.id` remains
compatible with existing foreign keys. `auth_sessions` is the target browser
session store. The legacy `sessions` table remains available to unmigrated users
during email remediation, but Better Auth wins when both credentials are
present. Purpose-bound setup sessions remain separate from both.

Normal Better Auth sessions use the library's seven-day rolling lifetime and
one-day refresh age, with no absolute cap. The authenticated shell calls
`refreshBrowserSessionFn` once on mount and when the window regains focus.
That function lets Better Auth extend eligible sessions and propagate its
cookie through the TanStack Start integration. Retained legacy sessions are
validated without extension.

Security-sensitive mutations additionally require recent authentication. A
Better Auth session is fresh for 15 minutes from its immutable `created_at`;
the inclusive boundary is stale (`now - created_at >= 15 minutes`). Rolling
expiry updates `updated_at` and `expires_at` but never renews freshness. The
central inventory in `@server/auth/freshness` covers current-account password
and email changes; TOTP enrollment, disablement, reset, and recovery-code
regeneration; passkey registration, removal, and security changes; API-key
creation, permission changes, deletion, and rotation; revocation of another or
all other browser sessions; and administrator-issued setup or recovery links.
Logout and revocation of the current session remain available without recent
authentication. Reads require it only when they reveal a one-time secret.

Only a normal Better Auth browser principal can satisfy this policy. API keys,
restricted setup credentials, forced-reset sessions, retained legacy sessions,
and trusted-device state cannot. A stale protected call returns 403 with the
stable `SESSION_NOT_FRESH` code; an invalid or ended session remains 401, and
insufficient operation-specific authority remains an ordinary 403. The client
responds only to the code: it opens one shared inline password or TOTP challenge,
then retries each waiting mutation once. Cancellation leaves the ordinary
session and form state intact and never navigates to the login wall.

Step-up delegates password and TOTP verification to Better Auth, with trusted
device disabled and recovery codes excluded. Success creates a new session
through Better Auth, atomically retires the old session, installs Better Auth's
cookie, and attributes the remainder of the request to the new non-secret
session id. Concurrent challenges have one durable winner; losing replacement
sessions are removed. The database replacement necessarily commits before the
response can install its cookie; if writing that response fails, the new row is
deleted, while the retired credential stays retired and the browser must sign
in again.

Account session management uses that numeric database session id only as an
opaque management id. Better Auth authenticates with the separate random
`token`; its native list and revoke routes are disabled so neither that token nor
another authentication-capable value can enter the account API. List and revoke
queries are always scoped by the principal's numeric user id. The list contains
only live Better Auth sessions and returns the full observed IP address, bounded
browser/OS labels, creation time, rolling `updated_at` as last activity,
effective expiry, and a server-derived current marker. Browser, OS, and IP are
recognition hints from client-provided headers, not device identity or suspicion
signals. Browser and OS labels are derived from Better Auth's bounded stored
user agent when the list is published; missing or invalid values use explicit
unknown fallbacks.

Selected and all-other revocation require recent authentication and never end
the current session; sign-out remains its termination path. A short-lived
self-reference protects a replacement created by a concurrent step-up until the
old row is deleted. Revocation takes effect on the next authoritative RPC check
and on the next SSE recheck; client query invalidation is only a local display
refresh and is not part of enforcement.

Ordinary server functions, React Query reads and mutations, raw routes, SSE
handshakes, revocation checks, reconnects, and HEAD probes use read-only session
resolution (`disableRefresh: true`). The browser doesn't poll sessions, track
input activity, send heartbeats, show a countdown, or display a warning dialog.
An unattended tab can't extend its session through background traffic.

After the authenticated shell arms `endSession()`, definitive session failures
from refresh, query or mutation HTTP 401 responses, and SSE HTTP 401 responses
converge on that idempotent path. It clears session storage and performs
full-document navigation to login with “Your session ended” and a return location.
Network and server failures are operational errors, not evidence that a session
expired.

Uploads and downloads must stream. Resolve a requested file to a database row
or explicit whitelist first, then use that row's `storage_key`; never construct
a key from URL parameters. Use the row's display name for
`Content-Disposition`.

Uploads use a direct Azure Block Blob protocol. The browser adapters and public
REST routes share the reservation and finalization service in
`@server/uploads/service`; file bytes never pass through the web server.

API clients reserve an upload, transfer and commit its blocks using the returned
write-only SAS, then finalize it. See the [upload API guide on the Virtool
website](../site/src/content/manual/api/uploads.mdx) for request shapes and the
complete protocol.

The former `POST /uploads` raw-body endpoint has been removed. This is an
intentional breaking change: there is no proxied upload or supported legacy
size limit.

When direct uploads are disabled or the storage backend cannot issue an upload
SAS, initialization returns `503` instead of falling back.

Both browser and API uploads enforce `settings.max_upload_size` through
`initializeUpload`. A valid declared size above the configured limit returns `413`
before a reservation or SAS is created. The limit is read on every initialization,
so changes apply to the next upload without a restart. `getUploadPolicyFn` exposes
the limit to authenticated users for client validation.

The setting and declared sizes are capped at the application ceiling of
120,000,000,000 bytes (120 GB), independent of the storage backend.

### The setup boundary

Some accounts are neither anonymous nor fully authenticated: an
administrator-created account that has not been claimed, an active legacy
account with no usable unique email, and a user under a `required` MFA policy
who has not enrolled. Each holds a **restricted setup credential** that
completes exactly one named transition and reaches nothing else.

Login checks an unmigrated legacy identity before Better Auth. During the
compatibility window, a matching legacy password mints a purpose-bound
`email_remediation` setup session, or a forced-reset session followed by that
setup session. Migrated identities continue through
Better Auth. A two-factor challenge keeps the login wall open for an authenticator
or recovery code; only successful verification establishes a session and checks
whether a password reset is required. Unknown, ineligible, and wrong-password attempts keep the same
generic response and constant-cost behavior. The remediation wall stages a
normalized unique email as unverified. When delivery is enabled, only the
emailed one-time link marks it verified; when delivery is unavailable, setup
completes immediately and leaves `email_verified` false. Online links carry
their token in the URL fragment, which the client removes before submitting it
to the open verification function. The token works without the initiating
browser's cookie and never authenticates a different browser. A matching setup
session has the same 72-hour expiry as the link and can be claimed once for one
Better Auth session; otherwise the result screen sends the holder to login.
Pending state is server-owned, reports terminal outbox failure, and supports a
server-throttled repeat delivery, address change, and cancellation. Completion revokes
legacy sessions; claiming promotion revokes the restricted setup sessions.

The credential is its own cookie pair, `setup_session_id` and
`setup_session_token`, deliberately not the session pair. `@virtool/data` owns
the rows and the purposes; this app owns the transport and the boundary.

- `@server/auth/restricted` is the **one** authority for what a restricted
  caller is. `resolveRestrictedSetup` turns the cookies into a credential
  carrying a user id, a non-secret session id, one purpose and an expiry—
  no roles, no permissions, no API-key cap. A second reader would be a second
  chance to widen it.
- The **global authentication middleware** enforces the restriction, before
  any policy runs. An application session wins outright; only then is the
  restricted credential considered, and a restricted caller is refused
  anything absent from `@server/auth/setupExceptions` with a 403
  `SetupRequiredError` naming the purpose. That error crosses the boundary
  through `serverErrorSerializationAdapter`, and is what tells the router
  which setup surface the caller belongs on—it carries no token and no
  authorization data.
- `setupOnly(purpose)` is the other half. The middleware decides whether a
  restricted caller may reach a function at all; the policy decides whether
  the purpose they hold is the one it completes, and refuses an ordinary
  authenticated caller too.
- A function listed in `setupExceptions` must declare `setupOnly()` and vice
  versa. `authorization.test.ts` pins both directions, and separately proves
  every ordinary server function refuses a restricted principal on its own.

`setupExceptions` contains only email-remediation operations that require the
restricted principal: read resumable state, submit or send an address again,
change/cancel the pending address, and claim promotion after cross-browser
verification. Bearer-token verification is open by design and decides only
mailbox ownership; it does not grant application authority on its own.

Raw routes reject restricted principals and always will:
`requireAuthenticatedRequest` reads the session cookies or an `Authorization`
header and never the setup pair, so SSE, uploads, downloads and streamed files
answer a restricted holder the same 401 they answer anyone else. API-key Basic
authentication is untouched—a restricted credential can never mint, accept
or inherit a key, and `verifyApiKey` refuses a key whose owner has not
completed setup.

`logout` is the abandon path. It deletes the restricted session and clears its
cookies alongside the application pair, so there is one way to end a browser's
authority rather than one per kind.

### Server push

Server-pushed cache invalidations arrive through the authenticated `/events`
SSE stream. Events are published as `{ domain, resource_id, operation }` on the
Postgres `client_events` channel; the route converts each event to the id-only
`{ domain, operation, id }` wire shape. The client then refetches through the
normal API so authorization remains at the request boundary.

Adding a domain requires all three of `SseDomainSchema`, `SseMessageSchema`,
and `reactQueryHandler`'s `domains` record. A frame that fails validation—an
unknown domain, a bad operation, a wrong id type—is contract drift and is
reported to Sentry.

The handshake uses `requireAuthenticatedRequest`. While connected, the server
rechecks the session on each keepalive interval and closes a revoked stream.
Because an `EventSource` error exposes no HTTP status, the client probes
`HEAD /events`: only a 401 ends the session; other failures reconnect with
backoff. A reconnect invalidates active queries to recover events missed while
the stream was down.

Most frames invalidate the narrowest matching React Query key. `jobs` and
`tasks` update frames instead go through `createJobRefreshQueue` and
`createTaskRefreshQueue`, which deduplicate ids, batch reads, and serialize
waves so an older response cannot overwrite newer progress. Keep the
active-observer filtering and do not restore per-frame `detail(id)` refetches.
The jobs queue also invalidates job lists because progress changes their state,
ordering, and counts; tasks have no collection query to invalidate.

| File | Responsibility |
| --- | --- |
| `packages/contracts/src/sse.ts` | Domain and per-domain message schemas |
| `packages/data/src/events/` | Postgres channel contract and publisher |
| `src/server/events/` | Listener, wire-shape conversion, and session revocation |
| `src/routes/events.ts` | Authenticated SSE route, keepalive, and framing |
| `src/app/sse/` | Connection lifecycle, validation, and query routing |
| `src/jobs/refresh.ts` | Batched job refresh queue |
| `src/tasks/refresh.ts` | Batched task refresh queue |

## Testing

[vitest.config.js](vitest.config.js) defines `web` (jsdom), `server` (Node and
Postgres), and `a11y` (Chromium) projects. Run all web-app projects with
`pnpm --filter @virtool/web test`, or select one with
`pnpm --filter @virtool/web exec vitest run --project <name>`. Follow the root
check policy for deciding which tests to run.

Place component and helper tests in adjacent `__tests__/` directories. Use
`renderWithProviders` or `renderWithRouter` from
[src/tests/setup.tsx](src/tests/setup.tsx). Mock server-function modules with
the typed stubs in `src/tests/server-fn/`, named `mock<ServerFnName>`; keep plain
data generators in `src/tests/fake/`. For raw transports, mock the module that
initiates the request. Missing mocks can cause real requests; no HTTP
interceptor catches them.

Test server-function handlers with
[callServerFn](src/server/test/serverFn.ts); its documentation explains how to
import the handler after the compiler transform.

Use `user-event` and accessible queries such as `getByRole` and `getByLabelText`;
don't disambiguate controls by index. Call `expectNoViolations(baseElement)`
from [axe.ts](src/tests/axe.ts) explicitly to include portals. For contrast
checks, use `*.a11y.test.tsx` with real theme classes and explicitly enable the
`color-contrast` rule. Install Chromium with
`pnpm --filter @virtool/web exec playwright install chromium`.

Local tests skip React Compiler; CI enables it with `VT_TEST_REACT_COMPILER=1`.

## Configuration

Server variables are validated before the listener starts. See
[configSchema.ts](src/server/configSchema.ts) for validation and
[the environment guide](../../docs/env.md) for file-backed values and key
rotation. Every runtime variable accepts a `_FILE` variant, which takes
precedence. Configure the required storage backend using
[the shared storage settings](../../packages/data/README.md#configuration).
The table below covers the remaining settings and web-specific storage behavior.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool. |
| `VT_PUBLIC_ORIGIN` | URL origin | Required | Public browser origin for authentication and WebAuthn, including behind a proxy. Use an HTTPS hostname (HTTP is allowed for localhost), with no path, query, fragment, or credentials. |
| `VT_AUTH_SECRET` | String (32+ characters) | Required | Sign and encrypt the authentication state Better Auth issues, including stored recovery codes. Generate with `openssl rand -base64 32`. Changing it invalidates every Better Auth session. |
| `VT_METRICS_TOKEN` | String | Unset | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404. |
| `VT_SENTRY_DSN` | URL string | Unset | Send server errors to Sentry. Vite also embeds this value in the client at build time; that client value can't use `_FILE`. |
| `VT_ENCRYPTION_KEY` | Base64 string (32 bytes) | Unset | Encrypt secrets stored by Virtool: the Resend API key and the NCBI API key. When unset or invalid, email is unavailable and GenBank lookups drop to the anonymous rate limit, but the server runs. See [the encryption-key guide](../../docs/env.md#encryption-key). |
| `VT_ENCRYPTION_KEY_PREVIOUS` | Base64 string (32 bytes) | Unset | Accept encrypted values written under the prior key during rotation. |
| `VT_STORAGE_AZURE_DOWNLOAD_URL` | URL origin | Unset | Rehost redirected Azure downloads on a public origin, such as `https://files.virtool.ca`. Applies only in `redirect` download mode. |
| `VT_STORAGE_AZURE_UPLOAD_URL` | URL origin | Unset | Rehost presigned Azure uploads on a public origin, such as a Front Door route to a private storage account. Falls back to `VT_STORAGE_AZURE_DOWNLOAD_URL`, then the Azure Blob endpoint. |
| `VT_STORAGE_DOWNLOAD_MODE` | `stream` \| `redirect` | `stream` | Serve file downloads by streaming the bytes through this server, or by 302-redirecting to a short-lived presigned storage URL. `redirect` falls back to streaming when the backend can't presign. |
| `VT_UPLOADS_CHUNKED` | Boolean | `false` | Enable direct Azure Block Blob uploads. When off, or when the backend can't presign uploads, initialization returns 503; there is no proxied fallback. |
| `VT_UPLOADS_CHUNKED_CONCURRENCY` | Positive integer | `8` | Set how many block PUTs a browser runs at once across all active uploads. Raise it to lift throughput on a high-latency upload path. |

## Metrics

`GET /metrics` shares the app's listener on port 9900. Set `VT_METRICS_TOKEN`
and send `Authorization: Bearer <token>` to scrape it. Without a configured
token the endpoint returns 404; invalid credentials return 401.

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

The [registry](src/server/metrics/registry.ts) defines the `virtool_*` request,
build, and Postgres pool series alongside standard process metrics. Request
latency measures time to response headers, including for streams. Pool gauges
count this replica's database connections, not queries waiting for a pool slot;
a failed pool probe leaves the previous values in place while the rest of the
scrape remains available. See [the metrics guide](../../docs/metrics.md) when
querying across services.
