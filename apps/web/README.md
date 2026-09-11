# @virtool/web

The Virtool SPA and its TanStack Start server. The root Dockerfile's `dist`
target is published as `ghcr.io/virtool/web`; see [CI](../../docs/ci.md#images).

Follow [AGENTS.md](../../AGENTS.md) for repository-wide rules and checks, and
[the development guide](../../dev/README.md) to run the app inside Coasts.

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
separate modules so importing a lightweight helper does not load them too.

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
cannot re-enable it.

For React Compiler compatibility, do not spread a `react-hook-form` methods
object, sync form props with `useForm({ values })`, and use
`@app/useMatchPartialPath` instead of `useMatchRoute`.

### Routing and data

Use Router `<Link>` and its `search` prop for internal navigation. Resolve
search defaults in `validateSearch`, strip them from URLs with
`stripSearchParams`, and use `@app/pagination` for paginated routes.

Call TanStack Start server functions through React Query. Keep query options,
hooks, mutations, and inline server-function calls in each feature's
`queries.ts`; do not add a separate `api.ts`. Build keys with `createQueryKeys`
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
Do not treat missing data as loading: an initial error has no data either.
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

### Error handling and request methods

Map expected domain failures in one module-local
`rethrowAsHttp(err: unknown): never` per `functions.ts`. Each expected 4xx branch
sets the response status and throws `ClientError` with the same status. Throw
unknown failures unchanged, preserving upstream error reporting. See
[errors.ts](src/server/errors.ts) for why setting the HTTP status alone is
insufficient. Local error mappers do not need `createServerOnlyFn` wrappers.

Server functions serialize an RPC body, so do not return 204, 205, or 304; return
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
`permission(name)`, or `setupOnly(purpose)`. Use the resolved `context.session`
or `context.restricted`; keep row-dependent authorization in the handler.
Register new `functions.ts` modules in
[src/server/__tests__/authorization.test.ts](src/server/__tests__/authorization.test.ts).
Keep `createServerFn` at the definition site so the compiler recognizes it.

Restricted setup credentials may complete only their named transition. Each
`setupOnly` function must also appear with the matching purpose in
[setupExceptions.ts](src/server/auth/setupExceptions.ts).

Raw routes handle transports RPC cannot provide, such as uploads, streaming
downloads, SSE, probes, metrics, and `/api/auth/*`. They enforce their own
authorization. `requireAuthenticatedRequest` accepts sessions and API keys;
server functions are session-only. Better Auth owns sign-in, while Virtool owns
account state and authorization; see [betterAuth.ts](src/server/auth/betterAuth.ts).

Use [streamStorageObject](src/server/http.ts) to stream stored files or redirect
to a presigned URL according to deployment configuration. Use the display name
for `Content-Disposition`. Direct upload reservations and finalization share
[src/server/uploads/service.ts](src/server/uploads/service.ts); file bytes go
to Azure Blob storage. See the [upload API guide](../site/src/content/manual/api/uploads.mdx)
for the protocol.

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
do not disambiguate controls by index. Call `expectNoViolations(baseElement)`
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
| `VT_SENTRY_DSN` | URL string | Unset | Send server errors to Sentry. Vite also embeds this value in the client at build time; that client value cannot use `_FILE`. |
| `VT_ENCRYPTION_KEY` | Base64 string (32 bytes) | Unset | Encrypt secrets stored by Virtool: the Resend API key and the NCBI API key. When unset or invalid, email is unavailable and GenBank lookups drop to the anonymous rate limit, but the server runs. See [the encryption-key guide](../../docs/env.md#encryption-key). |
| `VT_ENCRYPTION_KEY_PREVIOUS` | Base64 string (32 bytes) | Unset | Accept encrypted values written under the prior key during rotation. |
| `VT_STORAGE_AZURE_DOWNLOAD_URL` | URL origin | Unset | Rehost redirected Azure downloads on a public origin, such as `https://files.virtool.ca`. Applies only in `redirect` download mode. |
| `VT_STORAGE_AZURE_UPLOAD_URL` | URL origin | Unset | Rehost presigned Azure uploads on a public origin, such as a Front Door route to a private storage account. Falls back to `VT_STORAGE_AZURE_DOWNLOAD_URL`, then the Azure Blob endpoint. |
| `VT_STORAGE_DOWNLOAD_MODE` | `stream` \| `redirect` | `stream` | Serve file downloads by streaming the bytes through this server, or by 302-redirecting to a short-lived presigned storage URL. `redirect` falls back to streaming when the backend cannot presign. |
| `VT_UPLOADS_CHUNKED` | Boolean | `false` | Enable direct Azure Block Blob uploads. When off, or when the backend cannot presign uploads, initialization returns 503; there is no proxied fallback. |
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
