# Metrics

`apps/web` and `apps/internal`'s `serve` and `run` subcommands each expose
Prometheus metrics at `GET /metrics`, from their own process-wide registry. See
[apps/web/README.md](../apps/web/README.md#metrics) and
[apps/internal/README.md](../apps/internal/README.md#metrics) for what each
one emits and why. This file documents their shared query contracts.

## Error status policy

Both HTTP implementations record an `Error` that escapes request handling as
`status="500"`, matching their frameworks' unhandled-error responses. They
reserve `status="error"` for a thrown value that isn't an `Error`, where no
response status can be reported accurately.

## HTTP label sets

`apps/web` labels `virtool_http_requests_total` /
`virtool_http_request_duration_seconds` with
`handler_type, method, status, server_fn`; the `serve` subcommand labels the
same two series with `route, method, status`. The two sets encode
different things: a TanStack Start request's handler kind and server-function
name versus a Hono route's registered pattern. A query spanning both targets
must restrict itself to their shared `method` and `status` labels.
