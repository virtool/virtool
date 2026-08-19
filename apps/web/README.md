# @virtool/web

The web-app frontend for Virtool

The root Dockerfile's `dist` target is published as `ghcr.io/virtool/web`. See
[Continuous integration](../../docs/ci.md#images) for the shared image build
and release pipeline.

## Key libraries

- **React 19** with React Compiler, run as a Babel pass over `.ts` and `.tsx`
  via `@rolldown/plugin-babel` + `reactCompilerPreset`
- **TanStack Router** for routing
- **React Query** (`@tanstack/react-query`) for server state
- **zustand** for client state
- **react-hook-form** + **zod v4** for forms and validation
- **Tailwind CSS v4** for all styling
- **Radix UI** primitives for accessible components
- **CVA** (`class-variance-authority`) for component variants
- **Lucide React** for icons
- **d3** for the quality, coverage, and NuVs charts — imperative SVG, not a
  React charting wrapper
- **exceljs** for the analysis XLSX export — server-only, and reached through a
  dynamic `import()` inside `@server/analyses/export` so it stays out of every
  other bundle

## Client development

### Imports and bundles

- Use an existing specific path alias across directories; reserve `@/*` for
  `src/routes` and `src/types`. `tsconfig.json` is authoritative.
- Client code imports server declarations through `@server/*`, never by a
  relative path. Add every new feature alias to the server
  `noRestrictedImports` list.

The chunk is the unit of loading, not the export. If a chunk is reachable from
something loaded eagerly, the whole chunk is downloaded. Tree-shaking removes
unused code within a chunk; it does not decide which chunks a page fetches.

#### The eager half of a route

`autoCodeSplitting`, set on the `tanstackStart` plugin in `vite.config.js`,
splits every route file in two.

The critical half is `loader`, `beforeLoad`, `validateSearch`, and
`loaderDeps`. `routeTree.gen.ts` imports it statically, and that file is the
router's entry. Whatever the critical half reaches lands in the eager bundle
that every page load pays for, including `/login`.

Only the `component` half is lazy. An import that is expensive in a loader is
free in a component.

Never statically import a feature's `queries.ts` from the critical half. A
feature's query module carries its whole request layer: every server-function
stub and the zod schemas those stubs validate against. Pulling in one
`queryOptions` factory brings all of it. Import the factory inside the loader
body instead, as described in
[Query options and route prefetching](#query-options-and-route-prefetching).

`validateSearch` is synchronous, so it cannot defer zod with a dynamic import.
A zod schema there pins all of zod into the eager bundle. Use the
dependency-free coercion helpers in `@app/searchParams`, and type the function
so partial navigation still type-checks:

```ts
validateSearch: (input: Partial<FooSearch> & SearchSchemaInput): FooSearch => ({
	term: str(input.term, ""),
	...paginated(input),
}),
```

The `SearchSchemaInput` tag keeps `<Link search={{ page: 2 }}>` legal without
spelling out every other parameter.

#### Keep route-guard queries isolated

A `beforeLoad` that resolves an account, and any loader on `/login` or
`/setup`, runs for visitors with no session. Everything those reach is fetched
before a user can sign in, including modules reached through a dynamic
`import()`. Deferral changes when the chunk loads, not whether an
unauthenticated visitor loads it.

The `queryOptions` needed by guards therefore live apart from their feature's
`queries.ts`, each importing exactly one server function and nothing else:

| Module | Exports | Backed by |
| --- | --- | --- |
| `@account/account` | `accountQueryOptions`, `useFetchAccount` | `getAccount` |
| `@administration/passwordPolicy` | `passwordPolicyQueryOptions` | `getPasswordPolicyFn` |
| `@nav/queries` | `rootQueryOptions`, `useRootQuery` | `getRoot` |

The `@nav/queries` guard reads `firstUser` from the root query before any
session exists, so it cannot wait until after authentication.

Keep these queries isolated even when their feature module looks light. A
future request added to the shared module would otherwise ride onto the login
wall unnoticed.

#### Keep heavy dependencies isolated

A module's imports survive tree-shaking when the package does not declare
`sideEffects: false`. A grab-bag utility module can therefore leak its heaviest
dependency into every bundle that wants any of its exports.

`cn()` lives in `@app/cn` rather than `@app/utils` so `tailwind-merge` does not
enter every bundle that only needs a plain string helper. Keep it separate,
and isolate any utility that acquires a heavy dependency in the same way.

#### Keep server modules out of the browser graph

`src/server/**` is reachable from the browser program through `start.ts`, which
`routeTree.gen.ts` pulls in. A top-level import of a server-function module
from anything on that path drags the server graph, including dependencies such
as `prom-client` and `node:*`, into the client bundle.

Reach those modules through `createServerOnlyFn` and a dynamic import instead.
`auth/middleware.ts` is the worked example. `metricsMiddleware` uses the same
pattern so the metrics registry and `prom-client` never enter the client
graph.

#### Never bundle a native dependency

A package that loads a `.node` addon locates it relative to `__dirname`, which
has no value in an ES module. Bundling one can produce a server that builds
cleanly but throws `ReferenceError: __dirname is not defined` when the package
is first imported.

Nitro recognizes common native packages and traces them out of its bundle,
copying each into `.output/server/node_modules`. The production image ships
only `.output`, so nothing else would put them there. Use `traceDeps` on the
`nitro()` plugin only for a package Nitro does not already recognize;
`@sentry/profiling-node` is the current case.

The server is bundled in two stages, and Nitro cannot recover a package that
Vite inlined first. A native package therefore needs both of the following:

- An entry in `environments.ssr.resolve.external` in `vite.config.js`, so Vite
  preserves the import for Nitro.
- An entry in this app's `package.json` dependencies, even when only a
  workspace package imports it. Under pnpm, Nitro cannot resolve a dependency
  reached only through another workspace package from the app root. Add it to
  `ignoreDependencies` for `apps/web` in `knip.json` at the same time.

A green build does not prove this is correct because the failure occurs at
first import. Check the output:

```bash
grep -rn "__dirname" apps/web/.output/server/_ssr/
```

Every hit should define `__dirname` before using it. A bare read means a native
package was inlined.

### Rendering

Routes render on the server by default. Render must be pure and produce the
same initial result in Node and the browser:

- Do not read browser globals, time, randomness, locale, or mutable module
  state during render. A `typeof window` branch still causes a mismatch.
- Subscribe to ambient state with `useSyncExternalStore` and a cached server
  snapshot. Use `@app/serverNow` for elapsed time and `ClientOnly` for subtrees
  that must measure the browser.
- Hold viewer-local absolute times back with `useHydrated`; the server cannot
  know the viewer's timezone or locale.
- Give `<title>` exactly one string child, including inside SVG.
- Disable SSR only on the route that requires it; SSR cannot be re-enabled
  below a disabled parent.
- Never keep per-user render state at module scope. Server module state is
  shared by every request handled by the process.

React Compiler covers client `.ts` and `.tsx`. Do not spread a
`react-hook-form` methods object, sync form props with `useForm({ values })`,
and use `@app/useMatchPartialPath` instead of `useMatchRoute`. Local tests skip
the compiler; CI enables it with `VT_TEST_REACT_COMPILER=1`.

### Routing and data

- Use TanStack Router `<Link>` for internal navigation and its `search` prop
  for query strings. Use `<a>` only for external links or intentional reloads.
- Keep `/` as a terminal dashboard route; redirecting it recreates a chained
  redirect race.
- Resolve search defaults once in `validateSearch`, strip them from URLs with
  `stripSearchParams`, and use `@app/pagination` for paginated routes.
- Call the backend through TanStack Start server functions. Raw uploads,
  downloads, and SSE are the exceptions. Read a failed function's status with
  `getErrorStatus` from `@app/queryErrors`.
- Put feature requests and hooks in `queries.ts`. Generate keys with
  `createQueryKeys` in a separate `keys.ts`; do not re-export them from
  `queries.ts`.
- Use suspense queries for primary route data. For secondary data, show
  `QueryError` when `isError && !data` before checking `isPending`, preserving
  stale data after a failed refetch.
- Only suspense queries and loader prefetches participate in SSR. Plain
  `useQuery` starts in the browser after hydration.

#### Query modules and keys

There is one data-fetching transport: TanStack Start server functions called
through React Query hooks. Raw uploads, downloads, and SSE use their native
browser transports instead. A feature divides its cache surface between:

- `keys.ts`, containing only a `*QueryKeys` value built with
  `createQueryKeys(domain)` from `@app/queryKeys`;
- `queries.ts`, containing `queryOptions` factories, query and mutation hooks,
  and their inline server-function calls.

Do not add a per-feature `api.ts`, hand-write query keys, or re-export keys from
`queries.ts`. Keeping keys independent of the request layer lets invalidators
such as the SSE handler import them without pulling server-function stubs and
validation schemas into shared browser chunks.

Keys are tuples of primitives and must distinguish every parameter combination
deterministically. The factory makes them hierarchical: `lists()` invalidates
all list variants, `details()` invalidates every detail, and `all()` invalidates
the domain. Derive custom members from the base key whose invalidation should
reach them:

```ts
const userKeys = createQueryKeys("users");

export const userQueryKeys = {
  ...userKeys,
  nested: () => [...userKeys.lists(), "nested"] as const,
};
```

Give a custom variant its own segment. Do not use an empty filter list that
collapses a cache entry onto an invalidation prefix such as `lists()`.

#### Query options and route prefetching

Declare a reusable query's key and fetcher together with `queryOptions()`, then
use the same factory from its hooks and route loaders. Type an inlined factory
as `queryOptions<Result, Error>`; server-function failures are rebuilt as plain
`Error` values on the client.

Prefetch data needed for a page's first render in its route `loader` with
`ensureQueryData`. This route-splitting rule is specific to `apps/web`: import
the feature query module dynamically inside the loader body because loaders are
eager route exports. A static import puts the request layer in the initial
bundle, including for unrelated routes.

```ts
loader: async ({ context: { queryClient }, params: { sampleId } }) => {
  const { sampleQueryOptions } = await import("@samples/queries");
  await queryClient.ensureQueryData(sampleQueryOptions(sampleId));
},
```

Import independent modules and prefetch independent resources concurrently
with `Promise.all`. Data that is not needed until an interaction, such as
dialog content, should be queried where it is consumed instead of in a loader.

#### Loading and error states

Use two tiers based on how central the data is to the view:

1. Primary route data is prefetched in the loader and read with a
   `useSuspense*` hook. The component uses `data` directly; route Suspense and
   `RouteError` handle pending and error states. Preserve existing
   `404` to `notFound()` mappings when the route has a dedicated not-found
   state.
2. Secondary data uses `useQuery` and handles its states inline. Check
   `isError && !data` first and render `QueryError`, then check `isPending`.
   This keeps stale data visible when a background refetch fails.

Never combine missing data with loading:

```tsx
if (isError && !data) {
  return <QueryError noun="samples" />;
}
if (isPending) {
  return <LoadingPlaceholder />;
}
```

`if (isPending || !data)` is an error-state bug: an initial failure has no data
and would render a loading state forever. For multiple queries, show the inline
error when any query failed and any required result is missing, then handle
their pending states.

Paginated queries use `placeholderData: keepPreviousData` so the previous page
remains visible while the next page loads. Do not use the removed
`keepPreviousData: true` form from React Query v4.

#### Mutations and cache updates

Put cache invalidation in callbacks passed to `useMutation`; definition-time
callbacks run even if the calling component unmounts. Put navigation, toasts,
and other view effects in callbacks passed to `mutate`, which run only while
the caller remains mounted.

Invalidate the narrowest hierarchical key and let the server response refill
the cache. Reserve `setQueryData` for high-frequency updates where refetch cost
dominates; manual patches duplicate response-shaping, filtering, and ordering
logic.

### Styling

Use Tailwind utilities and `cn()` from `@app/cn`. Reuse or add design tokens in
`src/app/style.css` and animation tokens in `src/app/animations.css`; do not use
arbitrary utilities or hard-coded colors. Base component colors use the shared
`PaletteColor` across all variants.

The root font size stays at `100%` so browser font-size preferences work. To
preserve the original 14px design at the default 16px root, the `@theme` text,
spacing, container, breakpoint, and radius tokens are 0.875 of Tailwind's
defaults. Line height and letter spacing are not scaled. Consequently, classes
do not render at Tailwind's documented pixel values:

| Class | Tailwind | Here |
| --- | --- | --- |
| `text-sm` | 14px | 12.25px |
| `text-base`, `p-4` | 16px | 14px |
| `gap-2` | 8px | 7px |
| `md:` | 768px | 672px |
| `2xl:` | 1536px | 1344px |

`@base/Table` and `@base/BoxGroupTable` take a `variant`. `keyValue`, the
default, is the detail-panel shape: a narrow first column of row labels, ruled
off and top-aligned. `data` is a list of records, where the first column is a
field like any other. Give a `data` table sortable columns with
`@base/SortableHead`, which owns the `aria-sort` and direction-arrow rules and
leaves the sort state to the caller.

Size anything that holds text in `rem`; reserve pixels for graphics without
text. If an API requires a number, express it as a rem multiple and resolve it
with `useRootFontSize` from `@app/hooks`. Known exceptions are the virtualized
row heights in `NuvsList` and `IsolateList`, and the avatar text in
`InitialIcon`.

## Server development

### Layers and dependencies

A feature flows `functions.ts` → optional `service.ts` → `data.ts`:

- `functions.ts` is the TanStack Start boundary. It validates input, applies
  authorization, shapes the wire payload, and maps expected failures.
- `service.ts` coordinates multiple data operations when needed.
- `data.ts` contains framework-free domain and persistence code and lives in
  `packages/data/src/<feature>/`.

Imports follow that same direction and never flow back toward `functions.ts`.
Skip `service.ts` when the data layer covers the feature without cross-resource
orchestration.

Keep policy and decision logic separate from framework wiring. Put plain
functions over plain data in a framework-free module, then have hooks, loaders,
and handlers delegate to them. If a unit test cannot import its subject without
loading environment configuration, a database client, or framework code, split
the module at that dependency boundary instead of mocking the unrelated
dependency.

Inject data-layer dependencies in the order `db`, `storage`, `logger`; server
functions obtain them from `@server/composition`. Use `DbOrTx` for helpers that
may run in a transaction. Build validators from `@server/validation` primitives
and extend existing schemas instead of redeclaring their fields.

Expected 4xx outcomes set the response status and throw `ClientError` from
`@server/errors`; unexpected failures throw normally. Server functions must
not set 204, 205, or 304 because TanStack Start serializes an RPC body. Return
`null` with 200 for deletion instead.

### Server and client boundaries

`apps/web` type-checks server and browser code as separate projects. Browser
code imports server declarations through `@server/*`; server code must not
import the browser feature tree. Anything exported from `src/server` needs a
portable, explicitly nameable type when inference would expose a transitive
dependency.

Shared wire shapes belong in `@virtool/contracts`. Search there before adding
a type, import its names directly rather than re-exporting them through a
feature, and keep data-only option/value types in `@virtool/data`. Shape and
narrow results in `functions.ts`; do not repeat that parsing in React Query
`select` callbacks. Use `JsonObject` or `JsonValue`, not `unknown`, for opaque
JSON returned by a server function.

TanStack Start preserves `Date` values through its serializer, so server
functions return dates directly. Raw JSON contracts use `z.coerce.date()`.
Do not manually convert timestamps to ISO strings; timestamps embedded in
legacy JSONB blobs are the documented exception.

Server-rendered documents use a per-request CSP nonce for Router dehydration
and streamed React scripts. Set it through the router SSR options; never add it
by rewriting the response body, because doing so buffers the HTML stream.

### Authorization and raw routes

Every exported server function declares exactly one policy from
`@server/auth/policy`: `open()`, `authenticated()`, `adminRole(role)`, or
`permission(name)`. Read the resolved session from `context.session`; do not
perform a second session lookup. Row-dependent authorization remains in the
handler. Register each new `functions.ts` module in
`server/__tests__/authorization.test.ts`.

Keep `createServerFn` at the definition site. The Vite transform recognizes
the call syntactically and will not recognize a wrapper factory.

Use a raw `createFileRoute` handler only when RPC cannot provide the required
transport: upload progress, streaming downloads, SSE, health probes, or
Prometheus. Raw handlers do not receive policy middleware and must enforce
their own authorization. `requireAuthenticatedRequest` supports sessions and
API keys; server functions remain session-only. The Sentry tunnel and health
probes are deliberately public, while `/metrics` uses its bearer-token gate.

Uploads and downloads must stream. Resolve a requested file to a database row
or explicit whitelist first, then use that row's `storage_key`; never construct
a key from URL parameters. Use the row's display name for
`Content-Disposition`.

### Server push

Server-pushed cache invalidations arrive through the authenticated `/events`
SSE stream. Events are published as `{ domain, resource_id, operation }` on the
Postgres `client_events` channel; the route converts each event to the id-only
`{ domain, operation, id }` wire shape. The client then refetches through the
normal API so authorization remains at the request boundary.

Adding a domain requires all three of `SseDomainSchema`, `SseMessageSchema`,
and `reactQueryHandler`'s `domains` record. A frame that fails validation — an
unknown domain, a bad operation, a wrong id type — is contract drift and is
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

Component and hook tests run in the `web` jsdom Vitest project. Use
`renderWithProviders` or `renderWithRouter` from `src/tests/setup.tsx`; their
query client disables retries so rejected server-function mocks expose error
states immediately. Name component tests `ComponentName.test.tsx` and helper
tests `functionName.test.ts`.

Mock at the typed server-function boundary with the `vi.fn()` stubs in
`src/tests/server-fn/`. Plain data factories live in `src/tests/fake/`; a helper
belongs to exactly one of those directories. Raw upload, download, and SSE
callers are the only HTTP-shaped exceptions, and component tests mock the
module that initiates those requests rather than installing an HTTP
interceptor.

Server tests run in the `server` Node project against Postgres. A transformed
`createServerFn` export is only a client stub, so import its
`?tss-serverfn-split` module and invoke the handler with `callServerFn` from
`src/server/test/serverFn.ts`. That helper omits global authentication
middleware so the test exercises the handler's own authorization guard.

Prefer accessible Testing Library queries and give distinct controls distinct
accessible names; do not select unrelated controls by array index. Use
`expectNoViolations(baseElement)` from `src/tests/axe.ts` for opt-in axe checks
that include portals. Colour contrast runs in the browser-based `a11y` project:
name those files `*.a11y.test.tsx`, render lean subtrees with real theme
classes, and explicitly re-enable axe's `color-contrast` rule. Install its
browser once with `pnpm --filter @virtool/web exec playwright install chromium`
and run it with
`pnpm --filter @virtool/web exec vitest run --project a11y`.

## Using in Production

The default CSP configuration expects API requests to be made to the same domain as the
client is served from. The UI server and API server should be served from behind the same
reverse proxy.

## Configuration

Server variables are read at startup. Each also accepts a `<VARIABLE>_FILE`
variant containing the value; the file takes precedence, surrounding
whitespace is trimmed, and an empty value is treated as unset.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool. |
| `VT_METRICS_TOKEN` | String | Unset | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404. |
| `VT_SENTRY_DSN` | URL string | Unset | Send server errors to Sentry. Vite also embeds this value in the client at build time; that client value cannot use `_FILE`. |
| `VT_STORAGE_BACKEND` | `s3` \| `azure` | Required | Select the object-storage backend shared with the other Virtool services. |
| `VT_STORAGE_S3_BUCKET` | String | Required for S3 | Name the S3 bucket. |
| `VT_STORAGE_S3_REGION` | String | Unset | Set the S3 region. |
| `VT_STORAGE_S3_ENDPOINT` | URL string | Unset | Override the S3 endpoint; leave unset for AWS. |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | String | Unset | Set an explicit S3 access key. Set with `VT_STORAGE_S3_SECRET_ACCESS_KEY`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | String | Unset | Set an explicit S3 secret key. Set with `VT_STORAGE_S3_ACCESS_KEY_ID`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_AZURE_ACCOUNT` | String | Required for Azure | Name the Azure Storage account. |
| `VT_STORAGE_AZURE_CONTAINER` | String | Required for Azure | Name the Azure Blob container. |
| `VT_STORAGE_AZURE_ACCESS_KEY` | String | Unset | Set an Azure account key; leave unset to use managed identity. |
| `VT_STORAGE_AZURE_ENDPOINT` | URL string | Unset | Override the Azure Blob endpoint. |

The build and test tooling reads one additional variable. It is not a runtime
server setting and has no `_FILE` variant.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_TEST_REACT_COMPILER` | `1` \| unset | Unset | Enable React Compiler while running tests. CI sets it to `1`; local tests omit it for speed. |

Client code must read individual `import.meta.env` properties. Reading the
whole object would serialize every `VT_` variable, including storage secrets,
into the browser bundle.

## Metrics

`GET /metrics` serves the Prometheus text exposition format from a single
process-wide registry. It is one of three scrape targets — `apps/web`,
`apps/jobs-api`, `apps/tasks` — each with its own process and its own
registry; see [docs/metrics.md](../../docs/metrics.md) for the handful of
things only visible by comparing this implementation against the jobs
API's.

### Layout

| File | Responsibility |
| --- | --- |
| `src/server/metrics/registry.ts` | The `Registry`, every metric definition, and the record/render functions |
| `src/server/metrics/middleware.ts` | Global request middleware that counts and times requests |
| `@virtool/data/metrics/data` | Reads pool occupancy from `pg_stat_activity` |
| `@virtool/data/db/applicationName` | Builds the `application_name` that filter matches on |
| `src/server/metrics/handler.ts` | Token check, pre-scrape collection, response |
| `src/routes/metrics.ts` | The raw route |

### Why a raw route

Prometheus scrapes over plain HTTP with a `GET`. It cannot speak the
generated server-function RPC client, which posts to a hashed URL and
expects a framed response. So `/metrics` is a `createFileRoute` handler,
like `/uploads` and `/events`.

Routes get no policy middleware, so the handler enforces its own
authorization floor — see below.

### Authorization

`VT_METRICS_TOKEN` gates the endpoint:

- **Unset or empty** — the route reports `404`. This is the default, so
  upgrading an existing deployment never starts exposing internals by
  surprise.
- **Set** — the request must carry `Authorization: Bearer <token>`.
  Anything else gets `401` with a `WWW-Authenticate: Bearer` header.

In a cluster the token comes from a mounted file rather than the
variable: `VT_METRICS_TOKEN_FILE=/mnt/secrets-store/metrics-token`. That
is the general `_FILE` convention `config.ts` applies to every key, and
the file wins over a plain variable of the same name. The handler is
unaware of either — it reads `config.metricsToken`.

The comparison uses `timingSafeEqual`, screening for a length mismatch
first because it throws on unequal lengths. That screen reveals the
configured token's length; an attacker learns nothing from it that
meaningfully narrows the search.

The **scheme** is matched case-insensitively, as RFC 9110 §11.1 requires
— `bearer`, `Bearer`, and `BEARER` are the same scheme. The **credential**
after it is not: it is compared byte for byte, so a token differing in
case or carrying interior whitespace is a different token. Nothing trims
it, and nothing needs to — the `Headers` implementation already strips
the optional whitespace around a header value before the handler ever
sees it.

The gate exists because the server listens on **one port**
(`EXPOSE 9900`). There is no separate admin socket, so `/metrics` shares
its listener with the application and would otherwise be readable by
anyone who guesses the path. That is a different situation from
`/health/live` and `/health/ready`, which are deliberately contentless
and so cost nothing to expose.

Scrape config:

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

### Naming

Default process metrics — `process_resident_memory_bytes`,
`process_cpu_seconds_total`, `nodejs_eventloop_lag_seconds`,
`nodejs_gc_duration_seconds`, and the rest of `collectDefaultMetrics` —
keep prom-client's standard **unprefixed** names. Off-the-shelf Node
dashboards and alerting rules match those names exactly, and renaming
them buys nothing.

Everything defined here is prefixed `virtool_`.

### Series

#### `virtool_app_info{version}`

A gauge pinned at `1`, carrying the build version in a label. This is
the conventional `_info` shape: joining it onto another series in a
query is what correlates a change in behaviour with the deploy that
caused it.

#### `virtool_http_requests_total{handler_type, method, status, server_fn}`

Counter over every handled request.

`status` is the response status as a string, with one exception:
`"error"` for the rare non-`Error` throw that escapes the whole request
middleware chain. An `Error` that escapes it is recorded as `"500"`, not
`"error"` — h3's `toResponse`, outside this middleware's visibility,
wraps an escaping `Error` as an `HTTPError` and answers 500 by default
(the one way it wouldn't is a `.status` set on the error itself, which is
the server-function-only `ClientError` pattern, and `handleServerAction`
resolves that to a response itself rather than rethrowing — so it never
reaches this middleware's catch). A non-`Error` throw gets no such
treatment from h3 — it is read as a response *body* instead of an error —
so no status this middleware could report would be accurate for that
case, and `"error"` is reserved for it.

#### `virtool_http_request_duration_seconds{handler_type, method, server_fn}`

Histogram, bucketed from 5 ms to 10 s.

Duration is measured to the point the `Response` is returned, **not** to
the last byte of the body. For a streaming response — `/events`, an
upload — that is time-to-headers, which is what the latency of a
long-lived stream should mean. A histogram that instead recorded the
full stream duration would report every SSE connection as a multi-hour
request and make the p99 meaningless.

#### `virtool_postgres_connections{state}`

Gauge of this process's open Postgres backends, bucketed as `active`,
`idle`, `idle in transaction`, or `other`.

#### `virtool_postgres_pool_max`

The configured pool ceiling. Static, but it is the denominator: pool
saturation is only legible as
`virtool_postgres_connections / virtool_postgres_pool_max`.

### Cardinality

**No label may be unbounded.** Every series above draws its labels from
a fixed set.

The request path is deliberately **not** a label. Pathnames carry sample
ids, OTU ids, and reference ids; one label would mint a time series per
entity and eventually take down the Prometheus instance. Server
functions are identified by `serverFnMeta.name` — the original export
name, e.g. `getSampleFn` — which is bounded by the number of functions
in the codebase. Router requests get `server_fn=""`.

If per-route latency is ever needed, the label must come from a matched
route *pattern* (`/samples/$sampleId`), never a resolved pathname.

### Where the middleware sits

`metricsMiddleware` is registered in `start.ts` as a global
`requestMiddleware`, directly inside Sentry's. TanStack's request
middleware chain wraps both the server-function branch and the router
branch, so one middleware sees every HTTP request the process handles:
RPC calls, raw routes, and rendered pages alike.

Its position — above `csrfMiddleware` and `documentHeadersMiddleware` —
means its timing covers everything the request actually pays for,
including the CSRF check and the document-header rewrite.

Two constraints shape the file:

- `start.ts` is part of the browser program, because `routeTree.gen.ts`
  imports it. A static import of the registry would drag prom-client —
  and the `node:os`, `node:process`, and `node:perf_hooks` reads behind
  `collectDefaultMetrics` — into the client graph. So the middleware
  reaches the registry through `createServerOnlyFn` and a dynamic
  import, which the Vite plugin strips client-side. Node's module cache
  makes every call after the first a resolved-promise lookup.
- Recording runs on the path of every request in the process, so a
  broken registry must degrade the metrics rather than the service.
  Failures are swallowed and logged **once** — the causes (a label
  mismatch, a failed import) are deterministic and would otherwise
  produce one log line per request.

### Postgres pool occupancy

postgres.js **exposes no pool statistics**. Its connection queues
(`connecting`, `reserved`, `closed`, `ended`, `open`, `busy`, `full`)
are closure-local, and the only user-facing lifecycle callback,
`onclose`, has no `onopen` counterpart to balance it — a decrement with
no matching increment cannot drive a gauge.

`totalCount` / `idleCount` / `waitingCount` belong to **node-postgres**
(`pg`), a different library. Do not go looking for them here.

So occupancy is read from Postgres' own view instead. `createDb`
(`@virtool/data/db/pg`) sets a distinctive `application_name` on every
connection and hands it back alongside the pool:

```ts
const applicationName = buildApplicationName(service, hostname());

const client = postgres(config.postgresUrl, {
	max: config.postgresPoolMax,
	idle_timeout: IDLE_TIMEOUT_SECONDS,
	connection: { application_name: applicationName },
});
```

`src/server/composition.ts` re-exports it, and the handler reads it from
there. `readConnectionCounts` filters `pg_stat_activity` on it, scoped to
the current database. The hostname is part of the name so **each replica
counts its own pool**. Without it every replica would report the same
cluster-wide total, and summing the series in Grafana would multiply it
by the replica count.

The `service` — `"web"` or `"jobs-api"`, passed as `createDb`'s second
argument — is the other part, and it is what keeps **two services'
pools apart**. They share a database, and on a developer machine a
hostname as well, so without it each would count the other's backends
and both would report the sum. It is a separate argument rather than a
config field because it is a fact about the process, not something read
from the environment.

#### The name has to survive the round trip

`@virtool/data/db/applicationName` bounds the value at **63 bytes**. Postgres holds
`application_name` in a `NAMEDATALEN` buffer and truncates anything
longer *silently* — connections would then be opened under a clipped
name while the filter still searched for the full one, and every pool
gauge would read zero with nothing in the logs to say why.

The prefix is `virtool-ts-<service>@` — `virtool-ts-web@`,
`virtool-ts-jobs-api@` — which leaves 48 and 43 bytes respectively for
the hostname, and a long deployment name can overflow that. An
overflowing hostname is replaced by a truncated SHA-256 digest of itself
rather than clipped, because orchestrators put the part that
distinguishes one replica from another — the pod's random suffix — at
the *end*. Clipping would collapse a deployment's replicas onto one name
and reintroduce the multiplication the hostname was there to prevent.

The **service segment is never digested away**, only the hostname is. It
is short, bounded by the number of services shipped, and it is the
discriminator worth keeping legible — a digest that swallowed it would
put the web app and the jobs API back in one bucket for exactly the
long-hostname deployments most likely to have several replicas.

#### Collection is bounded, and happens in the handler

Collection happens in the handler, before rendering, rather than in a
prom-client `collect()` callback. A callback that rejects fails the
whole `registry.metrics()` call — and a Postgres outage is exactly when
the process metrics matter most. A failed read logs a warning and drops
only the pool gauges; the rest of the scrape still serves.

The read is also **time-bounded**, at two seconds. The probe is a query
on the very pool it measures, so a saturated pool queues it *client-side*
in the postgres.js closure, where nothing rejects and no statement
timeout applies. Unbounded, it would hang past Prometheus' scrape
deadline and cost the entire response — process and request metrics
included — in precisely the situation the pool gauges exist to diagnose.
Two seconds sits well inside a default 10s scrape timeout. The abandoned
query is left to settle on its own and its result discarded.

#### What this cannot see

Queries queued **client-side**, waiting for a free pool slot. That is
the true saturation signal, and it lives entirely in the postgres.js
closure. Recovering it means wrapping every query with an in-flight
counter — real instrumentation, not a read of existing state.

## Development

### Testing

The Vitest configuration defines three projects:

- `web` runs browser code under jsdom;
- `server` runs `src/server/**` under Node, matching production and avoiding
  cross-realm typed-array comparisons; and
- `a11y` runs `*.a11y.test.tsx` under headless Chromium so layout-dependent axe
  rules such as `color-contrast` can run. Install it with `playwright install
  chromium`.

`pnpm test` runs all three projects; pass `--project <name>` to narrow the run.
Package test projects do not belong in `apps/web/vitest.config.js`.
Place tests in `__tests__/` directories alongside the source they cover.

`src/tests/setup.tsx` provides `renderWithProviders()`, `renderWithRouter()`,
and `MemoryRouter`. Its test `QueryClient` sets `retry: false`, so failed
queries surface immediately.

Browser-side test doubles are split by purpose:

- `src/tests/fake/` contains `createFake*` data generators and no mocks.
- `src/tests/server-fn/` contains `vi.fn()` stubs for TanStack Start server
  functions. Name them `mock<ServerFnName>`, return the mock itself, and mirror
  the mocked `@server/<feature>/functions` module.

The SPA has no HTTP client or interceptor. Mock the server-function module;
nothing prevents an under-mocked test from making a real outbound request.
Workflow fixtures belong in `@virtool/workflow/testing`, never here.

A test cannot invoke an imported server function directly because the Vite
plugin moves its handler into a virtual `?tss-serverfn-split` module. Import the
split module and call it through `callServerFn` from `@server/test/serverFn`;
`groups/functions.test.ts` is the worked example.

Use `@testing-library/user-event` instead of `fireEvent`. Prefer accessible
queries such as `getByRole` and `getByLabelText` over `getByTestId`, and do not
disambiguate by index.

Call `expectNoViolations(container)` from `src/tests/axe.ts` explicitly for
each subtree under test. Colour contrast is disabled under jsdom; enable it in
an `*.a11y.test.tsx` test with:

```ts
expectNoViolations(element, {
  rules: { "color-contrast": { enabled: true } },
});
```

### Server-only package imports

`@virtool/data` and `@virtool/storage` may be imported by server-side apps,
including `apps/jobs-api`, `apps/tasks`, and the workflow apps. Within the web
app, however, they must not be imported into client-reachable code. A Biome
`noRestrictedImports` override enforces this in `src/**` outside `src/server/**`.

The `web` Vitest project also aliases `@server/composition`, `@server/config`,
and `@virtool/data/db/pg` to a guard that throws if one survives the client
transform.

### Working on the web app

Follow [the development guide](../../dev/README.md) to set up Tilt and Minikube,
then start the web app's live-edit target from the repository root:

```shell
tilt up -- --web
```
