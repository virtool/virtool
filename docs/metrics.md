# Metrics

`apps/web`, `apps/jobs-api` and `apps/tasks` each expose Prometheus
metrics at `GET /metrics`, from their own process-wide registry. See
[apps/web/README.md](../apps/web/README.md#metrics),
[apps/jobs-api/README.md](../apps/jobs-api/README.md#metrics) and
[tasks.md](tasks.md) for what each one emits and why — this file holds
only what a reader can't get from any single one of those.

## Two independent implementations converged on the same error policy

Neither `apps/web/src/server/metrics/middleware.ts` nor
`apps/jobs-api/src/app.ts` references the other, but both record an
ordinary `Error` that escapes request handling as `status="500"` — the
status their own framework's unhandled-error path actually answers with
(h3's `toResponse` for web, Hono's `onError` for the jobs API) — and
reserve `status="error"` for the rarer throw that isn't an `Error` at
all, where neither framework's default error handling applies and no
status either middleware could report would be accurate.

## `virtool_http_*` label sets differ by design, not by drift

`apps/web` labels `virtool_http_requests_total` /
`virtool_http_request_duration_seconds` with
`handler_type, method, status, server_fn`; `apps/jobs-api` labels the
same two series with `route, method, status`. The two sets encode
genuinely different things — a TanStack Start request's handler kind and
server-function name versus a Hono route's registered pattern — and
forcing them identical would mean inventing a route-pattern label for
web's traffic that its own code marks as a deliberate "if ever needed,"
not a current one. A query spanning both targets should restrict itself
to `method` and `status`, the one schema they actually share.
