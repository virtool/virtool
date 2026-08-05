# The jobs API

`apps/jobs-api` is the service workflow runners call to claim, run and
finish jobs. It is a plain Node process serving HTTP on port 9950,
deployed as its own Deployment behind a ClusterIP service with **no
ingress rule** — nothing outside the cluster can reach it.

It is called "the jobs API" everywhere: the directory, the package
(`@virtool/jobs-api`), the image (`ghcr.io/virtool/jobs-api`), the
Kubernetes service, the Sentry `service` tag, the pino logger `name`,
and the `application_name` it connects to Postgres under. "Control
plane" describes its role; it is not a second name for it. Python and
the workflow runtime already call it the jobs API, and a service with
two names across two repositories is a service nobody can grep for.

## Why it is a separate service

It mirrors the topology Python already has — `virtool/jobs/main.py`, a
separate aiohttp app served as `api-jobs-service` on 9950 — and the port
matches so the two can be swapped behind the same ClusterIP.

Two things follow from the split that do not follow from a shared
process:

- **A bug in the job-key guard is not remotely exploitable.** The
  runner-facing surface is not reachable from the internet at all, so a
  mistake in the credential check is a cluster-internal problem rather
  than a public one.
- **Workflow traffic and page-load traffic get separate pools and scale
  independently.** A burst of runners claiming jobs cannot exhaust the
  connection pool the SPA's page loads depend on, and neither side's
  replica count is hostage to the other's load.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Entry point: config, Sentry, pool, server, graceful shutdown |
| `src/app.ts` | `createApp` — the Hono app, its middleware and its routes |
| `src/config.ts` | Environment parsing, including every `<KEY>_FILE` variant |
| `src/instrument.ts` | Sentry initialisation and the `SERVICE` constant |
| `src/logger.ts` | The pino logger singleton |
| `src/metrics/registry.ts` | `createMetrics` — this process's Prometheus registry |
| `src/metrics/handler.ts` | Token check, pre-scrape pool read, response |
| `src/__tests__/authorization.test.ts` | The route-enumerating authorization floor |

Nothing is constructed at import time. `createApp` and `createMetrics`
are factories taking their dependencies as arguments, the same rule
`@virtool/data` and `@virtool/storage` follow — which is what lets the
authorization test build a whole app over fakes without opening a pool.

## Hono, and why

The handlers this service grows are ported from raw-route handlers
already written against Web `Request`/`Response`, so they move across
verbatim. Hono is a thin router over exactly those types; Express and
Fastify would each have meant rewriting every handler against a
framework-specific request object for nothing.

`@hono/node-server` adapts the app to `node:http`. `serve()` returns a
Node server, which is what the `SIGTERM` handler closes.

## It must never import from `apps/web`

In either direction. A `biome.json` override over `apps/*/src/**`
(excluding `apps/web/src/**`) bans every feature alias, `@server/**`,
the `@/*` catch-all, and relative reaches into `apps/web`.

This service is the likeliest offender, because it does work
`apps/web/src/server` also does — so copying an import from there is an
easy mistake. Shared code goes *down* into a package instead:
`@virtool/data` for persistence and domain functions, `@virtool/storage`
for object storage, `@virtool/contracts` for wire shapes and the two
server helpers below, `@virtool/logger` and `@virtool/sentry` for
observability.

## The authorization floor

`src/__tests__/authorization.test.ts` enumerates `app.routes` and
requires **every route** either to refuse an unauthenticated request —
401, 403, or 404 — or to be named in `PUBLIC_ROUTES` in `app.ts`, with a
comment saying why.

A route added without a floor therefore fails the build, by name, rather
than shipping open. That test landed with the skeleton and before any
endpoint, deliberately: a guard added after the endpoints it guards is a
guard written to match whatever those endpoints already do.

`PUBLIC_ROUTES` holds exactly two entries, both Kubernetes probes:

- `/health/live`
- `/health/ready`

The kubelet presents no credential, and a readiness probe that could
fail closed on an auth problem would take the pod out of service for the
wrong reason. Neither reveals anything beyond whether Postgres answers.

`/metrics` is deliberately **not** in that list. It enforces its own
bearer token and is expected to refuse like everything else.

The test also asserts the reverse: every `PUBLIC_ROUTES` entry names a
route that actually exists. A stale exception is as much a bug as a
missing one — it reads as a deliberate decision about a route that is no
longer there.

## Health

| Route | Meaning |
| --- | --- |
| `GET /health/live` | The process is up. Always `200`, no I/O. |
| `GET /health/ready` | `200` when Postgres answers, `503` when it does not. |

Both fold `checkPostgres` through `summarizeReadiness` from
`@virtool/data/health/data` — the same pair `apps/web` uses, so the two
services' probes cannot drift. Neither requires the metrics token: a
probe that needed a credential would be one more thing to get wrong
during a rollout.

## Metrics

`GET /metrics` serves the Prometheus text exposition from this process's
**own registry**, built by `createMetrics`. It is a separate registry in
a separate process from the web app's; the series names deliberately
match so one dashboard covers both, and the two are told apart by the
scrape's target labels and by `application_name`, not by renaming the
metrics.

Prometheus needs a **second scrape job** for this service, and an
authenticated one — the endpoint requires a bearer token.

### The token

`VT_METRICS_TOKEN` gates it:

- **Unset or empty** — `404`. Metrics are off until a deployment opts
  in, so upgrading never starts exposing internals by surprise.
- **Set** — the request must carry `Authorization: Bearer <token>`.
  Anything else gets `401` and a `WWW-Authenticate: Bearer` header.

The service being unreachable from the internet does not make the token
redundant: everything inside the cluster can reach a ClusterIP, and the
endpoint shares a socket with the API itself.

The comparison is `isBearerTokenValid` from `@virtool/contracts/bearer`,
which is constant-time. It is shared with `apps/web` rather than copied,
because two copies of a constant-time comparison are two chances to
quietly regress one of them into `===`.

### No label may be unbounded

The request middleware labels each observation with the route's
**registered path pattern**, via `routePath(c, -1)` from `hono/route` —
`/jobs/:jobId`, never `/jobs/1234`. The label is then bounded by the
number of routes rather than by the number of jobs. A request matching
nothing falls to the middleware's own `/*`, which is bounded too.

A handler that throws leaves no status behind, so those are counted as
`status="error"` — a bounded sentinel that keeps the counter's total
honest either way.

### Pool occupancy

`readConnectionCounts` (`@virtool/data/metrics/data`) filters
`pg_stat_activity` on the `applicationName` that `createDb` set. This
process passes `"jobs-api"` as `createDb`'s second argument, so it
connects as `virtool-ts-jobs-api@<hostname>` and counts **only its own
backends** — not the web app's, which share the database and, on a
developer machine, the hostname too.

The handler calls `readConnectionCountsBounded`, which applies the shared
`POOL_PROBE_TIMEOUT_MS` (two seconds). The probe is a query on the very
pool it measures, so a saturated pool queues it *client-side*, where
nothing rejects and no statement timeout applies; unbounded it would hang
past the scrape deadline and cost the whole response — process and
request metrics included — exactly when saturation is worth seeing. A
failed or slow read logs a warning and drops only the pool gauges.

The deadline lives in `@virtool/data` rather than beside each handler
because both services expose pool gauges and both need the same bound for
the same reason; a second copy is free to drift to a value that no longer
fits inside the scrape timeout.

## Sentry

Reports to the **same project** as `apps/web`, which is what makes one
search across the whole backend possible. Two options from
`getCommonOptions(service)` keep the two apart:

- `initialScope.tags.service` — `jobs-api`, so an issue list, an alert
  rule or a dashboard can narrow to one service.
- `dist` — also `jobs-api`. Every image in this repo shares the release
  version, so without it the two services' source maps collide under one
  release and a stack trace resolves against whichever uploaded last.

The DSN is passed to `initSentry` explicitly rather than read from the
environment by the SDK helper. `readDsn` goes straight to `process.env`
and would skip the `<KEY>_FILE` resolution that `config.ts` has already
done. No DSN means no `init`, so dev and unconfigured deploys are
untouched.

**The process must be started with `node --import @sentry/node/preload`**,
as the Dockerfile `CMD` and the `start` script both do. Because the DSN
comes from file-backed config, `Sentry.init` cannot run until config has
been read — by which point ESM has already evaluated every static import,
including `@hono/node-server` and `postgres`. The preload hook installs
the SDK's module hooks ahead of all of them, which is what makes that late
init safe. Drop the flag and the service still reports errors while
recording no HTTP or database spans, with nothing in the logs to say so.

There is **no `beforeSend` filter**, and that asymmetry with `apps/web`
is deliberate. The web app needs one because a server function signals an
expected 4xx by *throwing* `ClientError`, which would otherwise be
reported as a false incident. This service has no such mechanism: a Hono
handler returns a 4xx response rather than throwing, so nothing routine
reaches Sentry to be filtered. Add a filter only if a route starts
throwing for an expected outcome — and prefer not to.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VT_POSTGRES_URL` | *required* | Connection string |
| `VT_POSTGRES_POOL_MAX` | `10` | postgres-js pool size |
| `VT_JOBS_API_HOST` | `0.0.0.0` | Listen address |
| `VT_JOBS_API_PORT` | `9950` | Listen port, matching Python's jobs API |
| `VT_METRICS_TOKEN` | unset | Bearer token for `/metrics`; unset means `404` |
| `VT_SENTRY_DSN` | unset | Unset disables Sentry |

Every one also accepts a `<KEY>_FILE` variant naming a file to read the
value from, so a secret reaches a pod through the secrets-store CSI
driver's file mount rather than a Kubernetes `Secret`. The file **wins**
over a plain variable of the same name: a rollout moving to the mount can
still carry the stale variable from the `Secret` it replaces, and erroring
on the overlap would crashloop the very rollout that fixes it. An
unreadable path throws at startup; an empty file is an unset value.

That resolution is `resolveFileBacked` from `@virtool/contracts/env`,
shared with `apps/web` rather than copied so the precedence rule cannot
drift between the two services. It walks a list of keys the caller
names — `KEYS` in `config.ts` — so a key left off that list silently
loses its file variant. Add a key to both places.

Both helpers this service takes from `@virtool/contracts` sit behind
their own subpath exports (`/env`, `/bearer`) and are excluded from the
package barrel, because they use `node:fs` and `node:crypto` and most of
`@virtool/contracts` is imported by React components. The package
typechecks as two projects for the same reason: `tsconfig.json` covers
the browser-safe modules with no Node types at all, and
`tsconfig.node.json` covers just those two.

## The image

`ghcr.io/virtool/jobs-api`, built from the repo-root `Dockerfile`'s
`jobs-api` target and pushed by the release pipeline alongside the web
image.

The runtime base is **`node:24-alpine`**. This service copies nothing
from `ghcr.io/virtool/tools` and needs no bioinformatics binaries, so it
does not pay the Debian base the workflow images pay to satisfy those
binaries. Do not move it to Debian for uniformity's sake.

The app bundles to a single `dist/index.mjs` with tsdown, every
`@virtool/*` inlined from TypeScript source. `postgres` and `pino` stay
external and are materialised into the image by `pnpm deploy`; they are
listed verbatim as strings in `tsdown.config.ts`'s `neverBundle`, which
is also how knip sees them as used. `hono`, `@hono/node-server`,
`@sentry/node` and `prom-client` are externalised by default and are
imported directly by this app's source, so knip finds them without help.

## Deployment

The Kubernetes manifests live in a **different repository** — this one
carries no `k8s/`, chart or kustomization. What that repository needs
for this service:

- A Deployment running the `ghcr.io/virtool/jobs-api` image, with the
  liveness and readiness probes pointed at `/health/live` and
  `/health/ready`.
- A **ClusterIP** Service on 9950 and **no Ingress**. The absence of the
  ingress rule is the security boundary this whole service is built
  around.
- The `virtool` ServiceAccount, which carries the object-storage access
  the finalize endpoints will need to verify what a workflow wrote.
- A second, **authenticated** Prometheus scrape job carrying the bearer
  token, since the web app's scrape job cannot cover an endpoint on a
  different service with a different credential.

## What is not here yet

Only health and metrics. Every runner-facing endpoint — claim, ping,
step start, finish, and the three finalize routes — lands in its own
issue, against the wire contract already written in
`packages/contracts/src/jobsApi.ts`. `@virtool/storage` is deliberately
**not** yet a dependency: nothing here writes or reads an object, and
declaring it early would fail `pnpm knip` as an unused dependency. Add
it with the first endpoint that needs it.
