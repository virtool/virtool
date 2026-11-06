# Metrics

The web app and the `serve` and `run` subcommands of the internal app each expose
Prometheus metrics at `GET /metrics`, from their own process-wide registry. See
[the web guide](../apps/web/README.md#metrics) and
[the internal guide](../apps/internal/README.md#metrics) for what each one emits.
This guide gives the rules for queries across them.

## Error status policy

The web app and `serve` record an `Error` that escapes request handling as
`status="500"`. They use `status="error"` for a thrown value that isn't an
`Error`, where no response status is accurate.

A failed server-function call in the web app isn't an escaped `Error`. It
returns a 200 response that holds the serialized error, so `status` doesn't
separate failed calls from successful ones for `handler_type="serverFn"`.

## HTTP label sets

The web app labels `virtool_http_requests_total` with
`handler_type, method, status, server_fn`. `serve` labels the same series with
`route, method, status`. `virtool_http_request_duration_seconds` has the same
labels without `status`.

A query across both targets must use only the shared `method` and `status`
labels.
