# @virtool/tasks

The task service: **one** long-lived process carrying both halves of Virtool's
task system — the periodic spawner that inserts scheduled tasks, and the runner
that claims and executes what it spawns.

Image: `ghcr.io/virtool/tasks`. No ingress and **no Service** — its
HTTP listener serves only `GET /health/live`, `GET /health/ready` and a
token-gated `GET /metrics` on `VT_TASKS_PROBE_PORT` (**9900**).

Neither half has a flag to turn it off. The cutover from Python is two
deployments inside a minute, and a minute of task lag is invisible to a user,
so a staged rollout buys nothing.

## Shape

Everything is built inside `bootstrap()` (`src/bootstrap.ts`), the composition
root — config, logger, pool, emitter, storage, registry, listener. This app has
no module-scope singleton of any kind, so a module of it can be imported to read
a type without opening anything.

- `src/spawner.ts` — the periodic spawner, over `src/tasks/periodic.ts`
- `src/runner.ts` — claim, dispatch, heartbeat, drain
- `src/framework/` — `defineTask`, the progress writer and `runTask`
- `src/tasks/` — the task bodies, named for the `type` column in skewer case
  (`refresh-hmms.ts` for `refresh_hmms`), registered in `src/tasks/registry.ts`
- `src/download.ts` — downloading a release archive to disk, with the bounded
  retry, idle-stall timeout and status check `install_hmms` needs

A claim is a lease encoded on `acquired_at`, renewed every 60 s and live for
300. A reclaimed task re-runs from step zero, so **every task body must be
idempotent**.

## Task names and queue ownership

The task taxonomy lives in `@virtool/contracts`:

- `PeriodicTaskName` is the set this app schedules.
- `OnDemandTaskName` is the set request-handling code may pass to
  `createTask()`.
- `TaskName` is their union and the complete set this app executes.

`taskRegistry` is typed as a complete registry over `TaskName`, so changing the
shared taxonomy requires a handler here. `PERIODIC_TASKS` separately defines
the schedule and is checked against the registry. The taxonomy intentionally
does not record which feature creates each on-demand task; producers use the
shared `createTask()` boundary and keep their domain-specific lifecycle local.

Postgres queue persistence belongs to `@virtool/data`, including enqueueing,
claiming, leases, fencing, progress, completion, failure, release, metrics
reads, and `tasks` event publication. See the
[`@virtool/data` README](../../packages/data/README.md#task-queue).

## Task framework

Task bodies are defined with `defineTask()` and registered in
`src/tasks/registry.ts`. A definition supplies a task name, a zod payload
schema, optional ordered steps, a `run` function, and optional cleanup.
`runTask()` parses the row context before calling the body; invalid payloads
fail through the same terminal path as body errors.

Each declared step occupies an equal slice of 0–100 progress. A step reports a
fraction from 0 to 1, and the framework debounces, serializes, and keeps writes
monotonic. Task bodies do not write the `tasks` table or publish task events
themselves.

Cleanup runs after failure or cooperative abort, but not after success. Its
reason distinguishes terminal failure from an aborted run that another runner
will retry. Cleanup errors are logged without replacing the original outcome.

Every task body must:

- be idempotent because an expired or released claim restarts it at step zero;
- forward its `AbortSignal` into subprocesses and other waits;
- keep persistence and storage operations in framework-free data functions;
- throw errors rather than writing terminal task state itself;
- yield during CPU-heavy loops so the heartbeat can renew its lease.

## Spawner

The spawner checks `PERIODIC_TASKS` every 30 seconds. A task's interval is a
minimum suppression window, not an exact schedule, and a new row is created
only when no outstanding task of that type exists.

Each spawn attempt takes a transaction-scoped advisory lock derived from the
bare task name. This prevents multiple replicas from inserting the same
periodic task. A failure for one type is logged without skipping the remaining
types or stopping the loop.

During shutdown the spawner stops before the runner drains, so it cannot add
new work while claims are being released.

## Runner, leases, and fencing

Each replica runs one task at a time. The runner polls every two seconds and
claims only names present in `taskRegistry`. Replica count is the concurrency
control; the runner's in-flight and renewal APIs remain set-based so this can
change without redesigning lease storage.

A claim records a runner id and acquisition time. The heartbeat renews all
in-flight claims every 60 seconds against a 300-second lease. Expired leases
are reclaimable. Every runner mutation is fenced by task id and runner id, so a
runner whose lease has been reclaimed cannot update the new owner's task.

When renewal reports that a claim was lost, the runner aborts that task and
does not write or release it. Claim and heartbeat failures are logged and
retried rather than crashing the process.

## Probes and metrics

The probe listener accepts only `GET` on these routes:

- `/health/live` returns a static success response and never checks Postgres.
  A database outage must not restart every pod and kill tasks in flight.
- `/health/ready` checks Postgres and returns unavailable as soon as shutdown
  begins.
- `/metrics` requires the configured bearer token. When the token is unset the
  route returns 404.

The private Prometheus registry contains default Node metrics,
`virtool_app_info`, Postgres pool occupancy, and these task series:

| Series | Type | Labels |
| --- | --- | --- |
| `virtool_task_spawn_total` | counter | `type`, `outcome` |
| `virtool_task_runs_total` | counter | `type`, `outcome` |
| `virtool_task_duration_seconds` | histogram | `type` |
| `virtool_tasks` | gauge | `type`, `state` |
| `virtool_tasks_oldest_queued_age_seconds` | gauge | `type` |

Task names outside `TaskName` fold into the bounded `other` label. Queue reads
use the active predicate `complete = false AND error IS NULL`, are bounded by a
two-second deadline, and are cached for ten seconds. A failed read omits the
queue series rather than reporting a false zero or repeating stale values.

## Shutdown

The shared shutdown controller flips readiness, runs hooks in reverse
registration order, closes the listener, drains the pool, and flushes Sentry.
Failures are logged without preventing later steps, and the process exits
non-zero if any step fails. A second signal is logged and ignored.

The runner stops claiming, waits for its in-flight task within
`VT_TASKS_DRAIN_TIMEOUT`, aborts it if necessary, waits briefly for cooperative
cleanup, stops the heartbeat, and releases this runner's remaining claims. The
drain timeout is part of the total shutdown budget, not additional to it. The
container must execute Node directly so SIGTERM reaches these handlers.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/tasks build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/tasks start` | Run the bundle |
| `pnpm --filter @virtool/tasks test` | Run the Vitest suite (needs Docker — Postgres testcontainer) |
| `pnpm --filter @virtool/tasks typecheck` | `tsc --noEmit` |

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project has its own CI job and is excluded from `Packages / Test` so container
startup is not part of the fast package loop. It imports the shared container
setup from `@virtool/data/db/test/globalSetup`.

## Configuration

All variables are read at startup. Each also accepts a `<VARIABLE>_FILE`
variant containing the value; the file takes precedence, surrounding
whitespace is trimmed, and an empty value is treated as unset.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool. |
| `VT_TASKS_PROBE_PORT` | Positive integer | `9900` | Listen for health probes and Prometheus scrapes. |
| `VT_TASKS_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `40` | Bound the complete graceful-shutdown sequence. It must remain below the pod termination grace period. |
| `VT_TASKS_DRAIN_TIMEOUT` | Positive integer (seconds) | `25` | Allow an in-flight task to finish before releasing its claim. This must be less than `VT_TASKS_SHUTDOWN_TIMEOUT` and is part of that budget. |
| `VT_METRICS_TOKEN` | String | Unset | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404. |
| `VT_SENTRY_DSN` | URL string | Unset | Send errors to Sentry. When unset, Sentry is disabled. |
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

## Related documentation

[`docs/apps.md`](../../docs/apps.md) covers the bundling and `pnpm deploy`
pipeline shared by non-Vite apps. [`docs/ci.md`](../../docs/ci.md#images)
covers the shared image pipeline, and
[`docs/metrics.md`](../../docs/metrics.md) the metrics conventions shared
across services.
