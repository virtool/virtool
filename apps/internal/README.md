# @virtool/internal

Virtool's internal service: **one** image carrying four processes that share a
schema, a data layer and an object store but not a lifecycle. The subcommand is
the first argument to the bundle (`node dist/index.mjs <command>`):

| Command | Process |
| --- | --- |
| `serve` | The jobs API HTTP server workflow runners claim, update, and finish jobs through. |
| `run` | The periodic task spawner and the task runner, in one long-lived process. |
| `migrate` | Applies pending Drizzle migrations, then exits. Run as an init Job. |
| `auth` | Audits and migrates legacy identities, then exits. Run by hand. |

Image: `ghcr.io/virtool/internal`. The image is fused; the processes are not.
`serve` scales to N request replicas, while `run` is a lease singleton — folding
them into one process would multiply task-lease contention across every HTTP
replica, so they stay separate containers differentiated only by the argument
each passes.

`src/index.ts` is the dispatcher: it reads `argv[2]` and dynamically imports the
selected command's graph, so the migration Job never loads Hono and the HTTP
server never loads the task registry. Each command lives under its own
directory — `src/serve/`, `src/run/`, `src/migrate/`, `src/auth/` — and owns its
own config, Sentry service name (`jobs-api`, `tasks`, `migrate`, `auth`) and
fatal logging.

## `serve` — the jobs API

The process workflow runners use to claim, update, and finish jobs. Binds
`VT_JOBS_API_PORT` (**9950**) and is fronted by `jobs-api-service`.

See [Job lifecycle](../../docs/jobs.md) for the protocol shared with
`@virtool/workflow`, including cancellation, failure, retries, and exit codes.

### Workflow files and finalization

Workflow runners transfer bytes directly through object storage. The jobs API
records and serves complete storage keys; it does not derive a key from a row
id, legacy id, or filename.

A runner mints an output key with `mintStorageKey(domain, parentId)`, uploads
the object, and sends that key in one resource-finalization request:

- `PATCH /samples/{id}`;
- `PATCH /subtractions/{id}`; or
- `PATCH /analyses/{id}`.

The request carries the resource fields and its complete file manifest so the
parent cannot become ready without its file rows. Manifests omit `size` and
`name_on_disk`; the route validates that each non-empty key is beneath the
resource's `{domain}/{parentId}/` prefix, reads the object's size from storage,
and records the submitted key verbatim. Keys with a leading slash, an empty
segment, or a `..` segment are invalid.

The shared contracts enforce the minimum usable output: a sample has one or two
reads, a subtraction has at least its source FASTA, and an analysis requires
`results` but may have an empty file manifest. Subtraction runs write only
`subtraction.fa.gz`; reads still serve older subtractions whose rows also
contain Bowtie2 files.

Caches are the sole key-composition exception. `POST /caches` accepts a bare
UUID and composes its cache key server-side. The workflow uploads the cache blob
before registering it, and an already-registered logical key is success.

## `run` — the task spawner and runner

**One** long-lived process carrying both halves of Virtool's task system — the
periodic spawner that inserts scheduled tasks, and the runner that claims and
executes what it spawns. No ingress and **no Service** — its HTTP listener
serves only `GET /health/live`, `GET /health/ready` and a token-gated
`GET /metrics` on `VT_TASKS_PROBE_PORT` (**9900**).

Neither half has a flag to turn it off. A minute of task lag is invisible to a
user, so a staged rollout buys nothing.

### Shape

Everything is built inside `bootstrap()` (`src/run/bootstrap.ts`), the
composition root — config, logger, pool, emitter, storage, registry, listener.
This command has no module-scope singleton of any kind, so a module of it can be
imported to read a type without opening anything.

- `src/run/spawner.ts` — the periodic spawner, over `src/run/tasks/periodic.ts`
- `src/run/runner.ts` — claim, dispatch, heartbeat, drain
- `src/run/framework/` — `defineTask`, the progress writer and `runTask`
- `src/run/tasks/` — the task bodies, named for the `type` column in skewer case
  (`refresh-hmms.ts` for `refresh_hmms`), registered in
  `src/run/tasks/registry.ts`
- `src/run/download.ts` — downloading a release archive to disk, with the
  bounded retry, idle-stall timeout and status check `install_hmms` needs

A claim is a lease encoded on `acquired_at`, renewed every 60 s and live for
300. A reclaimed task re-runs from step zero, so **every task body must be
idempotent**.

### Task names and queue ownership

The task taxonomy lives in `@virtool/contracts`:

- `PeriodicTaskName` is the set this command schedules.
- `OnDemandTaskName` is the set request-handling code may pass to
  `createTask()`.
- `TaskName` is their union and the complete set this command executes.

`taskRegistry` is typed as a complete registry over `TaskName`, so changing the
shared taxonomy requires a handler here. `PERIODIC_TASKS` separately defines
the schedule and is checked against the registry. The taxonomy intentionally
does not record which feature creates each on-demand task; producers use the
shared `createTask()` boundary and keep their domain-specific lifecycle local.

Postgres queue persistence belongs to `@virtool/data`, including enqueueing,
claiming, leases, fencing, progress, completion, failure, release, metrics
reads, and `tasks` event publication. See the
[`@virtool/data` README](../../packages/data/README.md#task-queue).

### Task framework

Task bodies are defined with `defineTask()` and registered in
`src/run/tasks/registry.ts`. A definition supplies a task name, a zod payload
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

### Spawner

The spawner checks `PERIODIC_TASKS` every 30 seconds. A task's interval is a
minimum suppression window, not an exact schedule, and a new row is created
only when no outstanding task of that type exists. An outstanding row that
never finishes stops suppressing the type once it ages past the wedge ceiling
(`TASK_WEDGE_SECONDS`), so a runner stuck without ever completing or failing
its task cannot block the type for good.

Each spawn attempt takes a transaction-scoped advisory lock derived from the
bare task name. This prevents multiple replicas from inserting the same
periodic task. A failure for one type is logged without skipping the remaining
types or stopping the loop.

During shutdown the spawner stops before the runner drains, so it cannot add
new work while claims are being released.

### Runner, leases, and fencing

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

### Shutdown

The shared shutdown controller flips readiness, runs hooks in reverse
registration order, closes the listener, drains the pool, and flushes Sentry.
Failures are logged without preventing later steps, and the process exits
non-zero if any step fails. A second signal is logged and ignored.

The runner stops claiming, waits for its in-flight task within
`VT_TASKS_DRAIN_TIMEOUT`, aborts it if necessary, waits briefly for cooperative
cleanup, stops the heartbeat, and releases this runner's remaining claims. The
drain timeout is part of the total shutdown budget, not additional to it. The
container must execute Node directly so SIGTERM reaches these handlers.

## `migrate` — database migrations

Applies pending Drizzle migrations and exits. It reads a lean environment —
`VT_POSTGRES_URL` and the optional `VT_MIGRATIONS_PATH` — with none of the
storage credentials, ports or shutdown budget the long-lived processes need, so
the Job's pod spec carries only what a migration uses. It opens a single
connection (migrations are serial) and reports under the `migrate` service name,
so a migration holding a lock is distinguishable from a runner holding one in
`pg_stat_activity`.

The migration SQL is read off disk, not from the bundle: the Dockerfile copies
`packages/data/drizzle` next to `dist`, matching `DEFAULT_MIGRATIONS_PATH` in
`src/migrate/main.ts`. `VT_MIGRATIONS_PATH` overrides that so a migration can
run outside the image against the working tree's own `packages/data/drizzle`.

## `auth` — legacy identity audit and backfill

Audits the legacy user population and, when told to, backfills a Better Auth
credential account for every user whose identity is complete. It reads
`VT_POSTGRES_URL` and nothing else, opens one connection, and exits.

Run by hand, not by a Job. It is an administrative step in a release that moves
authentication, and the operator reads its report before deciding to apply.

```
node dist/index.mjs auth [audit|apply] [--report <path>] [--batch-size <n>]
```

| Argument | Meaning |
| --- | --- |
| `audit` | Classify every user and write no changes. The default. |
| `apply` | Classify, then migrate the eligible users. |
| `--report <path>` | Write the JSON report to this path, mode `0600`. |
| `--batch-size <n>` | Users per batch. Defaults to 500. |

Applying takes the word `apply`. A mode that rewrites production identities is
not something a deployment can reach by leaving an argument out.

The report is the machine-readable output: a format version, the generation
time, the mode, the user total, the count of every classification split by
activation state, one row per user an operator has to act on, the
normalized-email collision groups, and what the run did to `auth_accounts`. It
never carries a password hash, a session token or any other credential, and
neither do the logs. It does carry user ids, handles and email addresses, so
retain it the way you would any other account data.

Logs go to stdout, which is why the report goes to a file rather than sharing
that stream.

Exit codes:

| Code | Cause |
| --- | --- |
| 0 | The run finished and left nothing for an operator to resolve. Incomplete users are reported, not failed on — they are the population the remediation window exists for. |
| 1 | A configuration or argument error, a database missing the expected schema, a user whose password bytes are not a bcrypt hash, or a conflicting Better Auth row. |

Deployment sequence:

1. `migrate`, so the Better Auth tables and `users.auth_migrated_at` exist.
2. `auth --report <path>`, and read the report.
3. Resolve any conflict or unusable password it names, then audit again.
   Remediation is always followed by a fresh audit before apply is retried.
4. `auth apply --report <path>`.
5. `auth --report <path>` once more. That report is the authoritative remaining
   count, and it stays the way to watch the remaining population for the length
   of the legacy-password support window.

A run that dies partway leaves committed users migrated and the rest untouched;
rerunning resumes. Rerunning over a correctly migrated user writes nothing.

To recover a conflict, read the report's row for the user and compare their
`users` row with the `auth_accounts` row that names them. A credential account
that no user should hold is deleted; a `users.auth_migrated_at` with no
credential behind it is cleared, which returns the user to the population apply
migrates. Never edit a credential to make it agree — correct the row that is
wrong, then audit again. Apply is retried only after a fresh audit reports the
conflict gone.

The classification rules, the credential contract and the support window are
documented in [`packages/data/README.md`](../../packages/data/README.md).

## Metrics

Both long-lived subcommands own a private Prometheus registry and a token-gated
`GET /metrics` — `serve` on 9950, `run` on 9900. Each requires the configured
bearer token; when `VT_METRICS_TOKEN` is unset the route returns 404. Both
registries carry the default Node metrics, `virtool_app_info`, and Postgres pool
occupancy.

`serve` additionally exports HTTP request series and the job-queue depth series
the KEDA `ScaledJob` scales on. `run` additionally exports the task series:

| Series | Type | Labels |
| --- | --- | --- |
| `virtool_task_spawn_total` | counter | `type`, `outcome` |
| `virtool_task_runs_total` | counter | `type`, `outcome` |
| `virtool_task_duration_seconds` | histogram | `type` |
| `virtool_tasks` | gauge | `type`, `state` |
| `virtool_tasks_oldest_queued_age_seconds` | gauge | `type` |
| `virtool_email_delivery_attempts_total` | counter | `template`, `outcome` |
| `virtool_email_retries_scheduled_total` | counter | `template` |
| `virtool_email_accepted_age_seconds` | histogram | none |
| `virtool_email_outbox` | gauge | `state` |
| `virtool_email_availability` | gauge | `state` |

Task names outside `TaskName` fold into the bounded `other` label. Queue reads
use the active predicate `complete = false AND error IS NULL`, are bounded by a
two-second deadline, and are cached for ten seconds. A failed read omits the
queue series rather than reporting a false zero or repeating stale values.

The email series carry bounded labels only. `template` is the template type,
`outcome` is one of `accepted`, `retryable`, `rate_limited`, `permanent`,
`exhausted` or `expired`, and the whole cross product is pre-declared at zero so
a rate has a prior sample and a failure series at zero reads as evidence.
`virtool_email_accepted_age_seconds` is deliberately unlabelled, because
splitting it by template would thin the samples behind every quantile.
`virtool_email_availability` is one-hot, so
`virtool_email_availability{state="ready"} == 1` is directly alertable. The
`disabled` state still delivers: switching sending off stops new mail entering
the outbox, and `deliver_email` drains what was already queued, so the outbox
gauge falls to zero instead of holding until sending returns.

The probe listener (`run`) accepts only `GET`. `/health/live` returns a static
success and never checks Postgres — a database outage must not restart every pod
and kill tasks in flight. `/health/ready` checks Postgres and returns
unavailable as soon as shutdown begins.

## Configuration

All variables are read at startup by the subcommand that uses them. Each also
accepts a `<VARIABLE>_FILE` variant containing the value; the file takes
precedence, surrounding whitespace is trimmed, and an empty value is treated as
unset.

`VT_JOBS_API_*` apply to `serve`; `VT_TASKS_*` apply to `run`;
`VT_MIGRATIONS_PATH` applies to `migrate`; the rest are shared. `auth` reads
`VT_POSTGRES_URL` alone.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_JOBS_API_HOST` | String | `0.0.0.0` | `serve`: set the interface on which the API listens. |
| `VT_JOBS_API_PORT` | Positive integer | `9950` | `serve`: set the API listen port. |
| `VT_JOBS_API_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `30` | `serve`: bound graceful shutdown. It must remain below the pod termination grace period. |
| `VT_TASKS_PROBE_PORT` | Positive integer | `9900` | `run`: listen for health probes and Prometheus scrapes. |
| `VT_TASKS_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `40` | `run`: bound the complete graceful-shutdown sequence. It must remain below the pod termination grace period. |
| `VT_TASKS_DRAIN_TIMEOUT` | Positive integer (seconds) | `25` | `run`: allow an in-flight task to finish before releasing its claim. This must be less than `VT_TASKS_SHUTDOWN_TIMEOUT` and is part of that budget. |
| `VT_MIGRATIONS_PATH` | String | Bundled `drizzle/` | `migrate`: override the migrations folder, e.g. to run against the working tree. |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool (`serve` and `run`; `migrate` and `auth` always use one connection). |
| `VT_METRICS_TOKEN` | String | Unset | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404. |
| `VT_SENTRY_DSN` | URL string | Unset | Send errors to Sentry. When unset, Sentry is disabled. |
| `VT_ENCRYPTION_KEY` | Base64 string (32 bytes) | Unset | `run`: decrypt secrets stored by Virtool, currently the Resend API key for `deliver_email`. When unset or invalid, email is unavailable and every other task runs normally. See [the encryption-key guide](../../docs/env.md#encryption-key). |
| `VT_ENCRYPTION_KEY_PREVIOUS` | Base64 string (32 bytes) | Unset | `run`: accept encrypted values written under the prior key during rotation. |
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

`migrate` reads only `VT_POSTGRES_URL` and `VT_MIGRATIONS_PATH`, not the storage
or metrics keys.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/internal build` | Bundle to `dist/index.mjs`. |
| `pnpm --filter @virtool/internal test` | Run the Vitest suite (needs Docker — Postgres testcontainer). |
| `pnpm --filter @virtool/internal typecheck` | Run `tsc --noEmit`. |

Run a subcommand from the built bundle with `node dist/index.mjs serve`,
`node dist/index.mjs run`, `node dist/index.mjs migrate`, or
`node dist/index.mjs auth`.

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project has its own CI job and is excluded from `Packages / Test` so container
startup is not part of the fast package loop. It imports the shared container
setup from `@virtool/data/db/test/globalSetup`.

## Related documentation

[`docs/apps.md`](../../docs/apps.md) covers the bundling and `pnpm deploy`
pipeline shared by non-Vite apps. [`docs/ci.md`](../../docs/ci.md#images)
covers the shared image pipeline, and
[`docs/metrics.md`](../../docs/metrics.md) the metrics conventions shared
across services.
