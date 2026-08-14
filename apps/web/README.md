# virtool-ui

The web-app frontend for Virtool

## Using in Production

The default CSP configuration expects API requests to be made to the same domain as the
client is served from. The UI server and API server should be served from behind the same
reverse proxy.

## Configuration

| Option         | Env                | Description                                    |
| -------------- | ------------------ | ---------------------------------------------- |
| `-p`, `--port` | `VT_UI_PORT`       | The port the UI server should listen on        |
| `-H`, `--host` | `VT_UI_HOST`       | The host the UI server should listen on        |
| `--sentry-dsn` | `VT_SENTRY_DSN`    | The DSN that Sentry will send logged errors to |

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

### Working on `virtool-ui`

Use this guide to create your environment when you are contributing to `virtool/ui`.

1. Follow the instructions in the [`dev`](https://github.com/virtool/dev) repository's README to set up a local kubernetes cluster.

2. Clone this repository onto your local machine into the same parent folder as `dev`

    ```
    git clone https://github.com/virtool/virtool-ui.git
    ```

3. Start tilt with frontend editing enabled

    ```
     tilt up -- --to-edit ui
    ```
