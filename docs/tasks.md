# Tasks

`apps/tasks` (`@virtool/tasks`) is Virtool's task service: a long-lived Node
process that spawns periodic tasks and runs them. It is the TypeScript port of
Python's `task_runner`, and it ships as `ghcr.io/virtool/tasks`.

It is deliberately small in surface. It serves no API, has no Service and no
ingress, and the only HTTP it speaks is three routes on a probe listener. Its
work reaches the outside world through Postgres and object storage.

## One process, two halves

The spawner and the runner are **one binary**, not two. The spawner inserts the
scheduled tasks; the runner claims and executes them.

Neither half has a flag to turn it off. The cutover from Python is two
deployments inside a minute — delete Python's, create this one — and a minute of
task lag is invisible to a user, so there is nothing for a staged rollout to buy.
Don't reintroduce a mode flag or a second binary to stage it.

## Nothing happens at import time

`bootstrap()` in `src/bootstrap.ts` is this app's composition root, and it is
the *only* place anything is constructed. There is no config singleton, no
module-scope pool, no module-scope registry, and no `SHOW server_version` fired
as an import side effect. Importing any module of this app to read a type or to
test a function costs nothing.

That is a deliberate departure from `apps/web/src/server`, where `config`,
`db` and `storage` are module-scope constants: importing anything downstream of
those forces an environment parse and opens a pool. A process with a bootstrap
function and a test suite cannot afford that.

`bootstrap` runs this sequence, and three points in it are load-bearing:

1. **Parse config.** `parseTasksConfig()` — see below.
2. **Initialise Sentry.** *First*, so a failure anywhere below is reported.
3. **Create the logger.** After Sentry, so the "sentry initialised" line the
   status produces is the first thing written.
4. **Open the pool.** `createDb(config, "tasks")`.
5. **Install the client-event emitter.** `createEmitter({ client, logger })` —
   without it every `emit()` inside `@virtool/data` throws, and the `tasks`
   frames the data layer publishes never reach the SPA.
6. **Build storage.** `createStorageBackend(config.storage)`.
7. **Register signal handlers**, then **start the probe listener** — *last*, so
   nothing it reports on is still being built when the kubelet's first probe
   arrives.

A failure anywhere in that sequence propagates to `src/index.ts`, which logs
through a logger of its own — `bootstrap`'s may not exist yet — and sets
`process.exitCode = 1` without the listener ever starting.

**A listener that fails to bind closes the pool on the way out.** By step 7 the
pool is open and the signal handlers have already displaced Node's default exit
behaviour, so an occupied `VT_TASKS_PROBE_PORT` would otherwise leave a
container running forever on referenced sockets with no listener for the
kubelet to fail — the one state Kubernetes cannot restart its way out of.

### `AppContext`

What `bootstrap` returns, and the contract the spawn and claim loops build on:

```ts
type AppContext = {
	config: TasksConfig;
	logger: Logger;
	db: Db;
	client: PgClient;
	storage: StorageBackend;
	metrics: Metrics;
	onShutdown: (
		name: string,
		hook: () => Promise<void>,
		options?: ShutdownOptions,
	) => void;
	setReady: (ready: boolean) => void;
};
```

`db`, `client` and `storage` are passed into `@virtool/data` and
`@virtool/storage` functions as arguments, exactly as they are in `apps/web`.
Nothing imports a module-scope handle, because there is none to import.
`metrics` is the write side of the registry the probe listener already serves —
the spawn and claim loops record through it.

## Configuration

Every key is `VT_`-prefixed, and every key also accepts a `<KEY>_FILE` variant
naming a file to read the value from. That resolution is
`resolveFileBacked` from `@virtool/contracts/env` — shared with `apps/web` and
`apps/jobs-api` rather than copied, so its precedence rule cannot drift between
the three services.

Three of its behaviours are load-bearing and directly tested:

- **The file wins over a plain variable of the same name.** A rollout moving to
  a secrets-store CSI mount can still carry the stale env var from the
  `Secret` it replaces, and erroring on the overlap would crashloop the very
  rollout that fixes it.
- **An unreadable path throws at startup**, so a misconfigured mount fails
  loudly rather than silently falling back.
- **An empty file is an unset value**, and the contents are trimmed — the mount
  carries whatever the secret store had, trailing newline included.

| Key | Default | Notes |
| --- | --- | --- |
| `VT_POSTGRES_URL` | — | Required. |
| `VT_POSTGRES_POOL_MAX` | `10` | |
| `VT_TASKS_PROBE_PORT` | `9900` | Hardcoded in the manifests; fixed, not arbitrary in practice. |
| `VT_TASKS_SHUTDOWN_TIMEOUT` | `40` | **Seconds.** Must stay under the grace period — see below. |
| `VT_TASKS_DRAIN_TIMEOUT` | `25` | **Seconds.** A share of the shutdown budget, not an addition to it. |
| `VT_METRICS_TOKEN` | unset | Unset leaves `/metrics` reporting 404. |
| `VT_SENTRY_DSN` | unset | Unset disables Sentry. |
| `VT_STORAGE_BACKEND` | — | Required, `s3` or `azure`. |
| `VT_STORAGE_S3_*` / `VT_STORAGE_AZURE_*` | — | Same names and rules as `apps/web`. |

The schema is zod, in `src/config.ts`, and `TASKS_ENV_KEYS` is derived from it
rather than listed by hand — a key missing from that list would silently lose
its file variant.

An injected empty string reads as unset everywhere, which is what deployment
tooling emits for a value it has nothing to put in.

`VT_TASKS_DRAIN_TIMEOUT` must be strictly less than
`VT_TASKS_SHUTDOWN_TIMEOUT`, and the parse rejects it otherwise. The drain is a
share of that budget and the shutdown controller silently takes the smaller of
the two — so a drain set past the budget would quietly become a shorter one, and
the operator who raised it would see neither an effect nor a complaint.

## Probes and metrics

A plain `node:http` listener on `VT_TASKS_PROBE_PORT`. Three routes; everything
else, and every non-`GET`, is a 404.

### `GET /health/live`

Static `{"status":"alive"}`, with **no dependency of any kind — above all not
Postgres.**

A liveness probe that queries the database restarts the entire fleet on a
twenty-second database blip, killing every task in flight to fix nothing. A
CPU-bound task body starving the shared event loop is a second way to get a
working pod killed. Adding a check here is not an improvement; it is the
failure mode. A test asserts this route answers 200 with the database
unreachable.

For calibration: Python's `task_runner` has no probes at all today. Everything
here is net new.

### `GET /health/ready`

`checkPostgres` and `summarizeReadiness` from `@virtool/data/health/data`,
reporting 200 or 503. It answers 503 from the moment shutdown begins — before
any hook has run, and without querying — while the listener stays up so the
kubelet gets an answer rather than a connection refused.

Readiness earns its place where liveness does not, even though this process has
no Service: it drives a Deployment's `availableReplicas` and so its rollout
progress, `minReadySeconds`, and PDB counting. Without it a pod is Ready the
moment the container starts, and against `maxUnavailable: 0` that is the
difference between a safe rollout and a blind one.

### `GET /metrics`

A private `prom-client` `Registry` holding `collectDefaultMetrics` — left
unprefixed so off-the-shelf Node dashboards match — plus `virtool_app_info`,
Postgres pool occupancy, and the task series below. The `virtool_http_*`
series are deliberately absent: they are web-specific, their buckets top out
at 10 s, and this process serves nothing but probes.

The gate is `isBearerTokenValid` from `@virtool/contracts/bearer`, shared with
the other two services. It screens the length before `timingSafeEqual`, which
*throws* rather than returning false when the buffers differ in size; reducing
the comparison to `===` reintroduces the timing leak the helper exists to
close. Unset token means **404**, not open metrics, so an existing deployment
does not start exposing internals on upgrade.

How these pods get scraped is unsettled. A `prometheus.io/scrape` annotation
needs no Service and yields genuine per-pod series, but cannot carry a bearer
token — under the semantics above that means no metrics at all. If that is the
route taken, the handler needs a deliberate third state. Do not reach it by
quietly dropping the gate.

### The task and queue series

Five series beyond the process defaults, built by `createMetrics` in
`src/metrics/registry.ts`:

| Series | Type | Labels | Written by |
| --- | --- | --- | --- |
| `virtool_task_spawn_total` | counter | `type`, `outcome` | the spawn loop, via `recordSpawn` |
| `virtool_task_runs_total` | counter | `type`, `outcome` | the claim loop, via `recordRun` |
| `virtool_task_duration_seconds` | histogram | `type` | the claim loop, via `recordRun` |
| `virtool_tasks` | gauge | `type`, `state` | the scrape, via `setTaskQueue` |
| `virtool_tasks_oldest_queued_age_seconds` | gauge | `type` | the scrape, via `setTaskQueue` |

`outcome` on the spawn counter is `spawned`, `skipped_locked` or `not_due` —
the three ways a cycle can end for one scheduled type. On the run counter it is
`succeeded` or `failed`.

Seven rules hold these together:

- **`type` is bounded here, not by the column.** `tasks.type` is plain `text`
  with no CHECK constraint on either side, so a row may carry a name from a
  typo or from a future Python release. `TaskName` (`@virtool/contracts`) is
  the union of the nine names Virtool runs, and anything outside it folds onto
  `other` at the moment it becomes a label. Nothing narrows the column itself:
  a claimed row's `type` stays `string` all the way to `recordRun`.
- **The spawn counter is pre-declared over its whole cross product; the run
  counter is not.** A counter's children do not exist until one is incremented,
  and an absent series cannot be told from a zero one — which matters twice
  over for `skipped_locked`, since "the advisory lock was never contended" and
  "the counter was never wired up" must not look alike, and `rate()` needs a
  prior sample to subtract from. The spawn schedule is fixed at build time
  (`PeriodicTaskName`) so the cross product is knowable; which types a runner
  claims is configuration this registry never sees, so the run counter is
  observed-only.
- **`outcome` labels the counter and never the histogram.** Duration buckets
  are a property of the work, not of how it ended, and splitting them would
  halve the samples behind every quantile to express a dimension the counter
  already carries.
- **The buckets are task-sized: 1 s to 2 h.** `virtool_http_*`'s top out at
  10 s, which would put a reference import and an index build in the same
  `+Inf` bucket and leave the histogram unable to express a quantile above the
  median. The low end still resolves a BLAST sweep that finds nothing, which is
  the common case for the thirty-second schedule.
- **Every replica publishes the queue gauges.** There is no flag left to make
  the reader conditional, so N replicas each scan the same table to report N
  copies of one number. The scan is served by `idx_tasks_active` and a
  dashboard picks a single target, so it is waste rather than a problem — but
  it is the reason the handler still supports an absent reader.
- **A run is recorded only when it completed or failed.** `aborted` and
  `fenced` leave the row for another attempt, which is counted when *it* ends;
  recording them too would put `virtool_task_runs_total` above the number of
  tasks that actually ran. The duration is measured around the dispatch rather
  than from the row's `acquired_at`, which is Postgres's clock — mixing the two
  to save a round trip's accuracy is how a histogram acquires a fixed skew.
- **The whole `type` × `state` cross product is written as zero on each
  refresh**, so a type that drains reports zero rather than holding its last
  backlog forever — the worst possible failure for an alert on queue depth.
  Counts *add* into a folded label; an age takes the oldest of what falls into
  it.
- **A failed refresh drops the queue series rather than zeroing or keeping
  them.** An absent series says "unknown", which is the true answer during a
  Postgres outage and which `absent()` can alert on. Leaving them standing
  would have Prometheus record a stale depth as a fresh sample on every scrape
  of the outage; zeroing would assert an empty queue. The rest of the scrape is
  unaffected — a database outage is when the process metrics matter most.

### Postgres pool occupancy

`virtool_postgres_connections{state}` and `virtool_postgres_pool_max` are
read and rendered exactly as they are in `apps/web` and `apps/jobs-api`:
`readConnectionCountsBounded` (`@virtool/data/metrics/data`), filtered on
this process's own `application_name` — `virtool-ts-tasks@<hostname>`, built
by the same `buildApplicationName` every service uses — and bounded by the
same shared `POOL_PROBE_TIMEOUT_MS` (2 s). A failed or slow read logs a
warning and drops only these two gauges; the rest of the scrape, task series
included, still serves.

Reusing the shared helper rather than a task-specific check is deliberate:
the runner's claim and heartbeat loops make this process's pool just as
worth alerting on as the other two services', and a saturated pool here
queues the probe client-side in postgres.js exactly the way it does there.

### The queue read is Python's `get_counts`, term for term

`readTaskCounts` and `readOldestQueuedTaskAges` (`@virtool/data/tasks/data`)
count under `complete = false AND error IS NULL`, splitting on
`acquired_at IS NULL` for `queued` and `IS NOT NULL` for `running`. That is
Python's `TasksData.get_counts` exactly, and it is also the predicate of
Python's `idx_tasks_active` partial index — so the reads are served by it
rather than scanning a table whose completed rows accumulate without bound.
Reproducing it is what makes the pre- and post-cutover comparison
apples-to-apples; changing it silently invalidates that comparison.

Both terms are required, and neither implies the other. A Python failure writes
`error` and leaves `complete` false, so a row can be failed and incomplete at
once — which is why `failTask` here sets both.

The `type` breakdown is additional to Python, which reports two scalars.
Summing over `type` reproduces them exactly, so it costs the comparison
nothing and is what makes the gauge actionable.

`readTaskQueueBounded` runs both concurrently under one 2-second deadline, for
the reason every `/metrics` probe carries one: the query runs on the pool this
process claims and heartbeats over, so a saturated pool queues it *client-side*
where no statement timeout applies. `createTaskQueueReader`
(`src/metrics/queue.ts`) memoizes the result for 10 s and shares in-flight
reads, so two Prometheus replicas cost one query; a rejection is not cached.
The memoization itself is `createMemoizedReader`
(`@virtool/data/metrics/memoize`), shared with `apps/jobs-api`'s job-queue
reader rather than reimplemented per service.

### The version label

`virtool_app_info{version}` comes from a JSON import of the app's own
`package.json`, passed explicitly into `bootstrap`.

`apps/web` reads `__APP_VERSION__`, which is a **Vite** `define` and simply
does not exist in a bundled Node app: the label would render `undefined` with
nothing failing to say so. A JSON import is a real module value — the bundler
inlines it, `vitest` resolves it, and no ambient global is involved. It is only
*correct* in a released image because CI's `release-ghcr` job runs
`pnpm -C ${{ matrix.workspace }} version` before the Docker build, which this
app is covered by through its publish-matrix entry.

## Shutdown

Registering a SIGTERM listener **removes Node's default exit behaviour**. From
that moment, exiting is entirely this app's responsibility.

`createShutdownController` from `@virtool/service/shutdown` discharges that
with `process.exitCode` and a natural drain, **never `process.exit()`**. It is
a shared package rather than a module of this app because the jobs API winds
down the same way; every dependency below — the readiness flip, the listener
close, the pool drain, the Sentry flush and the budget — is injected by
`bootstrap`, so the controller itself knows nothing about tasks. Node's own documentation is explicit that `exit()`
forces the process down "even if there are still asynchronous operations
pending", writes to `process.stdout` included — which here means a dropped pino
line, an unsent Sentry envelope, and an uncommitted transaction.

On the first SIGTERM or SIGINT, each step awaited before the next:

1. **Readiness flips to unavailable.** The listener stays up.
2. **Registered hooks run in reverse registration order (LIFO)**, each awaited.
   A hook that throws is logged and does not abort the ones after it, but the
   process still exits non-zero.
3. **The probe listener closes.** Idle keep-alive sockets are dropped so the
   wait is bounded by a probe in flight rather than the next one.
4. **The database pool drains** — after the hooks, so a hook may still write.
   Releasing a task claim is exactly that.
5. **Sentry flushes.** `flush()`, never `close()`: `close()` flushes *and*
   disables, so anything raised later in shutdown would go unreported.

**No step aborts the ones after it, and none passes unreported.** Each is
caught and logged on its own, so a listener that will not close still leaves
the pool to drain and Sentry to flush.

That covers a step that *hangs* as well as one that throws, because the budget
is **divided rather than pooled**: every step gets a share of the time still
left when it starts, and is abandoned once that share is spent. A step that
finishes early hands its remainder on. Awaiting the whole sequence against a
single deadline instead would let one stuck socket eat the budget and take the
pool drain and the Sentry flush with it — losing the record of the failure
exactly when there was one to keep. An abandoned step is not cancelled, so the
process may still have to be reaped; what the division buys is that everything
after it still runs.

The share is **equal, except for a hook that declares a `timeoutMs` of its
own**. Equal division is right for a socket close or a buffer flush, where a
share is always more than enough, and wrong for a hook waiting out *work*: the
ceiling on any one step is the budget over the number of steps, so a task drain
would get a quarter of it however little the other three needed. A declared
ceiling is reserved out of what the unbudgeted steps divide, so it cannot starve
them. The task runner's drain is the only hook in the repo that uses it —
`VT_TASKS_DRAIN_TIMEOUT` of a `VT_TASKS_SHUTDOWN_TIMEOUT`, 25 s of 40 s by
default, leaving 5 s each for the listener, the pool and the Sentry flush.

Then `process.exitCode` is set — `0` only when every step ran, `1` if any of
them failed or the backstop fired first — and the loop drains. A failed
shutdown that exited `0` would be indistinguishable from a clean one, and an
undrained pool would pass unnoticed through every rollout.

A **second signal is logged and ignored.** Re-entering would run every hook
twice and close the pool out from under the first pass.

The backstop is `.unref()`'d. Without that it holds the event loop open for its
full budget on an otherwise clean shutdown, so a process that finished winding
down in 200 ms would still sit there for the whole forty seconds.

`VT_TASKS_SHUTDOWN_TIMEOUT` must stay strictly under
`terminationGracePeriodSeconds`, which covers `preStop` *and* shutdown
combined. The manifests use a 60 s grace period behind a 10 s `preStop` sleep,
leaving 50 s; the 40 s default is inside it. Set it too high and SIGKILL lands
before the backstop fires, and the process gets neither a clean shutdown nor a
controlled failure.

That `preStop` is inherited from the API base config and drains endpoints that
do not exist — this Deployment's Service is `$patch: delete`d — so removing it
hands the budget back a sixth of the grace period. Removing it belongs to the
deployment manifests, not here.

### The image must not use `npm start`

`CMD ["npm", "start"]` **does not forward signals** — npm/rfcs#829 is still
open, with no fix in npm 10 or 11 — so SIGTERM would never reach the handler
and every rollout would end in SIGKILL with claims still held. The image's
command is exec-form `node`:

```
CMD ["node", "--import", "@sentry/node/preload", "dist/index.mjs"]
```

The PID-1 kernel special case only drops signals with *no* handler, so
registering `process.on("SIGTERM")` covers the rest. `tini` and `dumb-init`
matter only for zombie reaping, which is irrelevant until a task body spawns
children.

## Sentry

`--import @sentry/node/preload` is not optional. ESM evaluates every static
import before any top-level statement, and the bundle makes that concrete: the
externals land at the top of `dist/index.mjs` while `Sentry.init` sits
thousands of lines below in the bootstrap body. Without the preload flag the
SDK's module hooks install too late to patch anything, and the service reports
errors while silently recording no database spans.

Init cannot simply move earlier: the DSN comes from `<KEY>_FILE`-backed config,
which has to be read first. That is exactly the "late initialization" case the
preload hook exists for. If the flag is dropped from the Dockerfile or the
`start` script, tracing goes quiet with nothing in the logs to say so.

The DSN is passed to `initSentry` explicitly rather than read by
`@virtool/sentry`'s `readDsn`, which goes straight to `process.env` and would
miss a `VT_SENTRY_DSN_FILE` mount. Events are tagged `service: tasks` and carry
their own `dist`, both from `getCommonOptions`, so this image's source maps do
not collide with the others' under the shared release version.

`initSentry` runs **before** the logger is built, and its returned `enabled`
flag is what decides whether that logger gets the pino destination from
`@virtool/sentry/log` — the shared stream that forwards `info`-and-above
records to Sentry's structured logging API. It takes `Sentry.logger` as an
argument, so the same stream serves this app, `apps/jobs-api` and `apps/web`
without any of them agreeing on an SDK. Without a DSN no stream is attached at
all and logs go to stdout only. Code wanting a *handled* failure reported as an
event rather than a log still calls `Sentry.captureException` explicitly.

## Testing

`apps/tasks` has its own Vitest project and its own CI job (`Tasks / Test`),
for the same reason `@virtool/data` and `@virtool/jobs-api` do: it runs against
a real Postgres testcontainer, and pulling that image does not belong in the
fast package loop. It is excluded from `Packages / Test` accordingly.

The container is **not described here**. `globalSetup` names
`@virtool/data/db/test/globalSetup`, the single definition every database-backed
suite in the repo shares, so the options cannot drift and `withReuse()` boots
one Postgres across all of them locally.

## The framework and the loops

`bootstrap` is the floor. The task framework, the claim/lease/reclaim data
layer, the runner and the spawn schedule sit on top of it:

- **Framework** — `defineTask`, the step model, and the percent/fraction
  progress seam. Lives in `apps/tasks/src/framework/`: it is an execution shell
  rather than persistence, only this process ever runs a task, and it needs zod,
  which `@virtool/data` does not depend on and should not start to. It
  publishes **no** frames of its own — see below. Its own section follows.
- **Claim, lease and reclaim** — `acquireTask`, `renewLeases`, `completeTask`,
  `failTask`, `releaseTask`, `releaseRunnerClaims`, `reclaimExpiredLeases`,
  `updateTaskProgress`. These are pure persistence over a table both halves
  write, so they belong in `packages/data/src/tasks/data.ts`, extending the
  module already there.
- **The spawner** — `apps/tasks/src/spawner.ts`, the tick loop, over the
  schedule in `apps/tasks/src/tasks/periodic.ts` and `createPeriodicTask` in
  the data layer. Its own section follows.
- **The runner** — `apps/tasks/src/runner.ts`, the claim loop, the dispatcher and
  the heartbeat. Its own section follows.
- **The task bodies** — `apps/tasks/src/tasks/<type>.ts`, registered in
  `apps/tasks/src/tasks/registry.ts`. The shell lives with its runtime, the way
  `functions.ts` lives with the web app. Their own section follows.

Note there is **no `service.ts` tier available to a task body.** `service.ts` is
the web app's orchestration layer and stays in `apps/web/src/server/<feature>/`,
unreachable from here. A body's cross-`data` orchestration goes either into
`@virtool/data` — when it is persistence plus injected external IO — or into
the handler module itself. Do not add a `service.ts` under `packages/data/`.

## The framework

Three modules under `apps/tasks/src/framework/`:

| Module | Holds |
| --- | --- |
| `define.ts` | `defineTask`, `TaskDef`, `TaskHelpers`, `TaskHandlerArgs`, `RegisteredTask`, `TaskRegistry` |
| `progress.ts` | `createProgressWriter`, `PROGRESS_DEBOUNCE_MS`, `roundHalfToEven` |
| `run.ts` | `runTask`, `TaskOutcome` |

A body declares a type, a payload schema and its steps, and gets back a payload
already parsed, an `AbortSignal`, a `runStep`, the injected context and a
logger. It never touches the `tasks` table, never emits, and never learns which
runner is executing it.

`defineTask` is identity at run time. It exists for two things: inferring the
payload type from the schema so neither `run` nor `cleanup` needs an
annotation, and **erasing** that payload type on the way out so one
`TaskRegistry` can hold tasks whose payloads have nothing in common. The
erasure is the reason there is no `any` in the registry type, and it is sound
because the only caller of `run` is `runTask`, which parses `payload` first and
passes what the schema produced. A body that reads `ctx` supplies both type
arguments: `defineTask<typeof payloadSchema, TaskContext>({ ... })`.

### Steps are equal slices of 0–100

`runStep(name, fn)` looks `name` up in the declared `steps` and gives it an
equal slice of the bar. Entry writes `step = name` and the slice's basis,
**immediately** rather than on the debounce — entering a step is the transition
a watching user notices. `report(frac)` clamps `frac` into `[0, 1]` and maps it
into the slice.

**A step writes nothing on the way out.** The next step's entry writes the same
value the exit would have, and the last step's end is what the completion
writes — so an exit write is a second `UPDATE` and a second frame for a number
already going out, and every frame is a refetch in every connected browser.
More than cosmetics: an exit write that fired however the step ended would
report a step that *threw* as finished, leaving a failed task sitting at 75%
and — on the abort path — releasing the row for another runner with a progress
value no attempt actually reached.

A task that declares **no** steps maps every step it runs onto the whole 0–100
bar. A task that declares them and then runs a name absent from the list has a
typo, and its reports are **dropped**, at `warn`: giving that step the whole
range would write 100 and, by the monotonic rule, silence every declared step
that came after it — a bar pinned at 100 for the rest of the run. Nothing ties
`runStep`'s `name` to `steps` at compile time, so this is the only place the
mistake surfaces.

Rounding is **half-to-even**, matching Python's `round`, not `Math.round`.
`Math.round(62.5)` is 63 and Python's is 62, and Python still runs tasks until
the cutover finishes; two runners writing different numbers for the same step
of the same task type is a difference nobody could explain later.

With four steps, entering the third writes 50, and `report(0.5)` inside it
writes 62 — arithmetically Python's `basis + progress * (1 / n)`, which is a
match rather than a divergence.

### Progress writes are debounced, monotonic and serialized

`createProgressWriter` coalesces writes on `PROGRESS_DEBOUNCE_MS` (250). A body
reporting per HMM profile would otherwise cost one `UPDATE` and one `tasks`
frame per item, and every frame is a refetch in every connected browser. A
quarter of a second is below what a bar needs to look continuous.

Three properties it holds:

- **Monotonic, from the value already on the row.** A value below one already
  recorded is logged at `debug` and dropped. Python's
  `TaskProgressHandler.set_progress` **raises** on a decrease, which means a
  rounding wobble or a retried chunk inside a data function destroys an
  otherwise-healthy reference import. Progress is cosmetic; it does not get to
  fail a task. The baseline is seeded from `ClaimedTask.progress` rather than
  from zero — a reclaimed task re-runs from step zero, and a writer starting at
  0 would send a run resuming at 87% straight back to the beginning of the bar
  in every connected browser.
- **Serialized.** Each write is chained behind the last, so a flush cannot race
  a debounced write into landing the older value second.
- **Fenced for good.** A write that matches nothing means the lease expired and
  another runner owns the task. The writer stops there — no further write, no
  further frame, no retry.

A write that throws is logged at `warn` and swallowed for the same reason the
decrease is: a task that did its work must not fail over a bar that did not
move. A database that is genuinely gone surfaces on the terminal write, which
goes through the same pool.

A body that wants to count items off against a total rather than compute a
fraction writes that arithmetic itself for now. Whatever ends up sharing it
must **guard `total <= 0`**: Python's `AccumulatingProgressHandlerWrapper`
divides blind, so a zero-length download raises `ZeroDivisionError` out of a
progress helper and fails a task that had nothing to do.

### The terminal contract

`runTask` returns a `TaskOutcome` and writes at most one terminal status. It
**always returns one** — a terminal write that rejects is folded into an
outcome rather than escaping, since a rejection would leave the caller with no
outcome to act on and the claim standing until its lease ran out.

| Outcome | When | Row |
| --- | --- | --- |
| `completed` | `run` returned, signal clear | `complete = true`, `progress = 100` |
| `failed` | `run` threw, or the payload failed its schema | `error` set |
| `aborted` | the signal aborted, or a terminal write was refused | untouched — the caller releases |
| `fenced` | a guarded write matched nothing, or the lease was gone | untouched — another runner owns it |

A refused terminal write — a pool timeout, a reset connection — is `aborted`
because it leaves the row in exactly the state an abort does: this runner's
claim, not complete. The caller releases it and the task runs again, which
every body is required to be idempotent for.

Progress is flushed before either terminal write, so a bar can never be
stranded at the value a pending debounce was holding.

`signal.aborted` is sampled **once**, immediately after `run` returns and
before that flush. The flush is a round trip; an abort arriving inside it would
otherwise turn a run that finished into an abort, tear down work that
succeeded, and leave the task to be done a second time. A signal that is
already aborted when `runTask` is entered returns `aborted` **without running
the body at all** — the claim and the dispatch are not one operation, and a
body started during a drain gets killed mid-write with nothing recorded.

An error is recorded as `` `${err.name}: ${err.message}` `` — `String(err)` for
a non-`Error`. Python writes `f"{type(e)}: {e!s}"`, which puts
`"<class 'ValueError'>: boom"` in front of a user; the name alone is what
anyone reading the task list wants.

A payload the schema rejects fails the task **before any handler code runs**,
with a message beginning `Invalid payload`. `cleanup` does not run for it —
nothing ran to clean up, and there is no parsed payload to hand it.

Abort **wins over a throw**. A body interrupted mid-shutdown usually throws on
its way out, and recording that as a permanent failure would burn a task whose
only problem was the pod going away.

`runTask` does not release, retry or reschedule. What to do with an `aborted`
or `fenced` outcome is the runner's.

### `cleanup` runs on every outcome but success

Including the one that is easy to miss: a handler that notices
`signal.aborted` and returns **cleanly**. That path looks exactly like success
to a `catch`-only implementation and skips the cleanup silently, which is why
there is a test for it by name.

It does **not** run after a fence. Another runner owns the task and is
re-running it from step zero; a cleanup here would be tearing down the new
owner's work.

**The claim is renewed and checked immediately before the cleanup**, rather
than inferred from the progress writer's fence flag. That flag only flips when
a progress write happened to be outstanding, so a body with coarse steps — or
one that throws before its next `report` — reaches the cleanup still believing
it holds a task another runner reclaimed 300 s ago. The renewal answers the
question directly and holds the claim for however long the cleanup takes. A
renewal that *rejects* skips the cleanup too and reports `aborted`: tearing
down a task another runner may have taken over is worse than leaving a
half-built one behind.

Progress is flushed **again** after the cleanup. A cleanup reports through the
same writer, and its debounce timer is `.unref()`'d — so without the second
flush its write either lands after the terminal one, where it matches nothing
and logs a fence that never happened, or is dropped silently on the way out of
a shutdown.

A throwing `cleanup` is caught and logged and never rethrown. Losing the
failure that provoked it to a secondary error in the handler meant to tidy up
after it is how an original cause disappears.

#### `reason` tells the two outcomes apart

`cleanup` receives a `reason` of `"failed"` or `"aborted"`. A failed task is
over; an aborted one is about to be released and claimed again from step zero.
**A body that tears down anything its own next attempt reads must branch on
it** — `install_hmms` is the case that forced the parameter, where a cleanup on
drain empties the state its re-run needs and the re-run then writes everything
and records none of it.

**Never read `signal.aborted` inside a cleanup instead.** `runTask` samples the
signal *before* the flush and lease renewal that precede the hook, and acts on
what it sampled; an abort landing in that window leaves the live signal and the
row disagreeing. `reason` carries the sampled value.

### A reclaimed task re-runs from step zero

The claim query deliberately dropped Python's `progress = 0` filter, so a task
whose lease expired starts again from the top with whatever partial work the
previous attempt left in place. Nothing records which steps already ran.

**Every task body must be idempotent.** `taskId` is on `TaskHandlerArgs`
precisely so a body can key its own idempotency off it, and a `runStep`
boundary is the natural place to check whether the work is already done.

### The progress seam into `data.ts`

A data function reports progress through an injected callback and never learns
that a task exists:

```ts
export async function populateSomething(
	db: DbOrTx,
	values: SomethingValues,
	onProgress?: (percent: number) => Promise<void>,
): Promise<void>;
```

- **Optional and trailing**, and deliberately not universal — several task
  bodies pass nothing.
- **Percent (0–100)** at the `data.ts` boundary. `runStep`'s `report` takes a
  **fraction (0–1)**, because it is scaling into a slice. A body bridges the
  two explicitly: `async (percent) => report(percent / 100)`.
- **Called with optional-call syntax at every site**: `await onProgress?.(n)`.
- `data.ts` never imports the framework, never touches the `tasks` table and
  never emits.

It composes by rescaling. A caller that does 5% of the work itself before
handing off maps the child's full range into the band it has left:

```ts
export async function populateImportedReference(
	db: DbOrTx,
	values: ImportValues,
	onProgress?: (percent: number) => Promise<void>,
): Promise<void> {
	await createReferenceRow(db, values);
	await onProgress?.(5);

	await insertOtus(db, values.otus, async (percent) => {
		await onProgress?.(5 + percent * 0.95);
	});
}
```

And in the body, where the fraction and the percent meet:

```ts
await helpers.runStep("import_otus", async (report) => {
	await populateImportedReference(ctx.db, values, async (percent) => {
		report(percent / 100);
	});
});
```

### Testing the framework

`apps/tasks`'s own Vitest project, against `createTestDatabase()` from
`@virtool/data/db/test/fixtures` — a real row, a real claim and a real
`LISTEN`. Two things are asserted rather than assumed:

- **Intermediate progress values**, not just a terminal `progress = 100`. A
  body that jumps straight to complete passes a terminal-only assertion.
- **The frames themselves**, collected off `client_events` with a sentinel
  frame published last so a count of zero means zero rather than "not yet".
  A row that changed is not evidence a frame went out.

The debounce is exercised by passing `debounceMs` rather than by faking
timers: a window long enough never to close proves coalescing, and the flush
before the terminal write proves the last value still lands.

The frame collector is `collectFrames` in `apps/tasks/src/testing/frames.ts`,
which takes the `PgClient` to listen on. It is the harness the body tests share
with the framework's own, so the sentinel protocol is written once.

## Task bodies

A body is a module under `apps/tasks/src/tasks/`, named for the value in the
`type` column in skewer case — `refresh-hmms.ts` for `refresh_hmms`. It exports
one `defineTask` result and registers in `apps/tasks/src/tasks/registry.ts`.

`refresh_hmms` is the first, and the worked example for the nine that follow.
Every decision below is visible in it.

### The body is a shell; the work is in `data.ts`

```ts
export const refreshHmmsTask = defineTask<typeof payload, TaskContext>({
	type: "refresh_hmms",
	payload,
	steps: ["refresh"],
	async run({ ctx, helpers }) {
		await helpers.runStep("refresh", async () => {
			await fetchAndUpdateRelease(ctx.db);
		});
	},
});
```

The domain function is `@virtool/data`'s and knows nothing about tasks. The body
adds the step name, the payload schema and the registration, and nothing else.
A body that grew a query would be putting persistence somewhere the web app and
the jobs API cannot reach it.

### The registry is the allowed-types filter

`taskRegistry` maps each type to its body, and its **keys are what the runner
hands `acquireTask`**. That is the whole of how an unrecognised `tasks.type` is
rejected: a row naming a task absent from the registry is never claimed, so it
stays queued for the Python runner that does know it. Nothing validates the
column and nothing needs to, because the filter *is* the registry.

It is a literal map rather than one derived from each body's `type`, so the set
of names this process claims reads in one place. `registry.test.ts` pins the two
against each other — a key that disagreed with its body's `type` would claim
under one name and dispatch another — and pins every key to `TaskName`.

### `ctx` is `{ db, storage }`

These are the handles a body cannot construct, injected the way `data.ts` takes
them. Its logger, its payload and its `taskId` arrive on `TaskHandlerArgs`
instead, because those are per-run rather than per-process. A body that reads `ctx`
supplies both type arguments to `defineTask`; one that does not reads none of
this.

There is no module-scope anything. `bootstrap()` builds the context and the
runner passes it in, so importing a body to test it opens no pool.

### A step name is Python's function name

`refresh_hmms` declares one step, `refresh`, which is what Python's `BaseTask`
writes into the column — it stores `func.__name__` of the bound method it is
running. Both runners write the same name for the same work, which is what makes
the cutover comparison possible. A slugified display name would change the shape
of a task's step list at the moment the fleet switched over.

A single step is the degenerate case and stays explicit: declaring `steps` gives
the framework the slice arithmetic, and a body that declared none would map its
one step onto the whole bar to the same effect but say less.

### A body that has no progress to report declares none

`fetchAndUpdateRelease` is one request and one upsert, with no intermediate
position worth publishing, so it takes no `onProgress` seam. The bar moves 0 →
100 on the framework's step-entry and completion writes alone, and the run
publishes exactly two frames. The seam is opt-in per data function — see the
progress seam above — and adding one where there is nothing to report costs a
write and a refetch in every connected browser for no information.

### A body forwards its signal into anything that waits

`runTask` awaits the body. It does not race it against the signal the way
`runWorkflow` races a step, so **nothing interrupts a body on its own** — an
abort is a request the body has to act on. `refresh_hmms` forwards its `signal`
into `fetchAndUpdateRelease`, which combines it with the fetch deadline through
`AbortSignal.any`.

Two things go wrong without that. The drain waits out the in-flight task before
aborting and then waits a bounded grace, so a request left to run its own
ten-second deadline out holds shutdown open for that long. And when the grace
expires the runner releases the claim regardless — leaving the abandoned attempt
free to finish its request and write, on behalf of a runner that no longer owns
the work. The `tasks` row is safe either way, every write to it being fenced on
`runner_id`, but a domain row is not.

An abort from the caller's signal is **rethrown untranslated and records
nothing**: the process is going away, and writing `Could not reach Virtool.ca`
onto the status row would blame virtool.ca for a shutdown. `runTask` samples
`signal.aborted` after the body returns, so the outcome is `aborted` rather than
`failed` and the row stays claimable.

### Errors surface by throwing

A body that throws fails the task: `runTask` writes `${err.name}: ${err.message}`
to `error`, sets `complete`, and returns `{ status: "failed" }`. There is no
error channel of a body's own and no partial-success state.

**`refresh_hmms` can therefore fail, and Python's cannot.** Python's
`fetch_and_update_release` builds its `errors` list by substring-matching the
exception's `str()` against `"ClientConnectorError"` and `"404"`, neither of
which any exception it catches ever contains — so `errors` is always `[]`, the
`raise` guarded on it is unreachable, and a refresh that reached nothing
finishes as a success against a stale release. Deciding between a stale release
and a current one is the entire point of the call, so this side records the
message on `legacy_hmm_status.errors` *and* rethrows — which marks the task
failed rather than complete. The next spawn ten minutes later supersedes it.

Neither string is rendered anywhere today: `HmmInstall` reads the status row for
its task's progress and step alone, and there is no task list page. They are
recorded because the row is what the next reader has — an operator on the
database, a support question, or the page that eventually shows them.

The manifest fetch also carries an `AbortSignal.timeout`, which Python does not.
`fetch` has no deadline of its own, and a hung connection inside a task holds its
lease open until the lease expires — at which point another runner reclaims the
task and starts a second hung fetch behind the first. A timeout is reported as
`Could not reach Virtool.ca`, the same as a refused connection, because to the
caller it means the same thing.

### `create_index`, the second body

`create_index` finishes a reference index build. Its body is one call to
`generateTaskIndex` (`@virtool/data/indexes/data`) inside one step,
`build_index` — Python's method name, so both runners write the same value to
the `step` column. The domain function patches every OTU in the build's manifest
back to the version the manifest pins it to, writes the result to object
storage as `reference-snapshot.v1.sqlite` and `reference-v2.json.gz`, registers
an `index_files` row for each, stamps `legacy_otus.last_indexed_version` and
flips `ready`. The snapshot is the artifact an analysis reads; the gzipped JSON
is kept because the other implementation still falls back to it.

It is the first body to take the progress seam. Python's task declares no
progress handler and jumps 0 to 100; this is the longest-running of the ten and
the chunked patch loop makes its position knowable, so the data function takes a
trailing `onProgress?: (percent: number) => Promise<void>` and the body bridges
it with `async (percent) => report(percent / 100)`. Percent at the `data.ts`
boundary, fraction at `runStep`'s reporter.

Five decisions are worth knowing before changing it.

**The manifest is walked once per artifact.** The snapshot's rows go in as they
arrive and the JSON streams as it is serialized, so neither holds a reference —
and holding the patched documents for a second consumer would put the whole
thing in the heap, which is the one outcome the chunk loop exists to prevent. A
second walk costs a repeat of the patch reads and nothing else. Progress is
split across the two, the snapshot reporting 0–50 and the JSON 50–100, so the
bar never goes backwards.

**An already-ready build is a successful no-op.** Python raises
`ResourceConflictError("Index is already ready")`. Porting that verbatim would
fail the task whenever a reclaim re-ran a build whose work had already
committed — a red error in the UI against an index that is perfectly fine — so
this side logs at `info` and returns. That is the general shape for any body
guarding on a terminal-state column.

**Nothing is buffered.** A real reference decompresses to hundreds of megabytes
of JSON, and Python holds all of it twice: once as a list of documents and again
as a gzip buffer. Here the manifest is patched 500 OTUs at a time —
Python's `OTU_ID_CHUNK_SIZE` — and each chunk is serialized straight into a
`createGzip()` stream handed to `StorageBackend.write`, so peak memory is set by
the chunk size rather than by the reference. Python's `concurrency=25` /
`window_size=100` patcher is deliberately not reproduced: `patchOtusToVersions`
resolves a whole chunk in a fixed handful of queries, so there is nothing for
that apparatus to do.

The chunk loop also `await setImmediate()`s. The heartbeat that holds the lease
is a timer, and serializing a whole reference in one synchronous stretch starves
it — the task is then reclaimed out from under a runner that is still working on
it.

Two failure modes the streaming introduced, both guarded. `pipe` does not
forward a source error to its destination, so the encoder's failure is
explicitly forwarded onto the gzip stream; without it a manifest naming a
version history cannot produce would end the stream cleanly and publish a
truncated artifact as a successful build. And a manifest entry that patches to
`null` throws `IndexManifestError` rather than being serialized — a manifest
entry is proof the OTU existed at that version, so a null is corruption, not a
routine miss.

**The OTU order is the manifest's stored order.** It is read back with
`jsonb_each ... with ordinality`, not from the parsed `manifest` column.
`JSON.parse` hoists array-index-like keys to the front of an object and sorts
them numerically; an OTU id is eight characters drawn from digits and lowercase
letters, so a reference of any size is likely to have one that is all digits.
Python iterates the dict `json.loads` gives it, which is the JSONB order, and
the artifact's OTU order decides which isolate `cd-hit-est` keeps as a cluster
representative — so a divergence here changes analysis results.

`reference.created_at` is rendered in SQL for the same class of reason. Python's
orjson writes six fractional digits, or none when there are no microseconds;
`Date.toISOString` always writes exactly three and postgres.js has already
truncated the other three, having parsed a naive `timestamp` with `new Date(x)`
— which V8 reads as local time, so a process outside UTC would shift every
timestamp in the artifact.

**There is no compensating delete on failure.** The storage write happens first
and outside the transaction, because storage cannot join one. A write that lands
where the commit does not leaves an object no row names — and so does a hard
exit between the two, which no `catch` can cover, so the orphan is the sweep's
either way and a cleanup here would only handle the half where the process
survives. Python's second, fresh-session delete of the `index_files` row is
dropped for a different reason: its three writes are one real transaction here,
so a database failure rolls the row back on its own.

The one delete the body does make is **after** the commit. Keys are minted per
write rather than composed from the file name, so a rebuild writes a new object
and the upsert repoints the row at it — leaving the previous artifact orphaned
on every successful rebuild. That one is deleted immediately and its failures
logged, never raised, because the build has already succeeded.

### `evict_caches_lru`, the third body

`evict_caches_lru` reclaims object storage by deleting the least recently used
caches until the store is back under budget. Its body is one call to
`evictLruCaches` (`@virtool/data/caches/data`) inside one step, `evict` —
Python's method name — and it reports no progress: the candidate count is not
known until the select returns, and the deletes that follow are a handful of
round trips, so there is no position worth publishing.

**The budget is a constant, not configuration.** `CACHE_STORAGE_BUDGET_BYTES`
is 100 GiB, Python's `CACHE_STORAGE_BUDGET` default, and there is no `VT_` key
behind it. How much of the bucket caching may spend is application state shared
by the whole fleet, not a fact about the pod reading it, and a per-replica
environment variable is the wrong shape for that. It is passed into
`evictLruCaches` as an argument rather than read inside it, so a test can drive
the selection at a size it can seed.

**Candidate selection is one statement.** Python takes two — a `SELECT
sum(size)` and then the candidate query — and this side folds the total into a
scalar subquery, removing the window in which a concurrent write could change
the figure the second statement selects against. The candidates come from a
window function, `sum(size) OVER (ORDER BY last_accessed_at ASC, id ASC)`, and a
row qualifies while the bytes ahead of it fall short of what has to be freed.
That comparison is what admits the last candidate, the one carrying the total
past the target: without it the run would stop just short and leave the store
over budget. Python's `bytes_to_free <= 0` early return needs no equivalent —
the preceding bytes are never negative, so no row satisfies the comparison
against a non-positive target, and an under-budget store selects nothing.

**The grace period filters the candidates but not the total**, and that quirk is
inherited on purpose. A cache younger than an hour is never evicted — it was
written by one workflow for the next, and the two can be that far apart — but
its bytes still count toward the overage being solved. A store that is over
budget on nothing but fresh entries therefore frees less than it needs, or
nothing at all, and waits for them to age. Both runners have to choose the same
rows until the cutover completes, so the fix is a shorter grace period, never a
differently-scoped sum.

**Objects go before rows**, eight deletes at a time, and nothing is deleted from
the table until every object is gone. A failure part-way through leaves rows
naming objects that are gone — which a later run reclaims, being still the least
recently used, and which a reader can at least detect. The other order leaks
objects no row names, and eviction walks rows, so nothing would ever find them
again. Every delete is attempted before the first failure is raised, matching
Python's `gather(..., return_exceptions=True)` and re-raise: a bucket refusing
one key says nothing about the rest.

The exact `storage_key` recorded on the row is deleted, never a prefix — the key
is a per-write uuid and a prefix delete would reach another row's object. The
rows then go in one `DELETE ... WHERE id = any($1) RETURNING id`, over a single
array parameter rather than an `in` list, and only the ids that come back are
logged. A row another writer removed between the select and the delete is not
this run's to report.

The signal is forwarded, and because `StorageBackend.delete` takes none it is
checked between deletes. That is what keeps a run holding hundreds of objects
from outliving the drain and deleting rows on behalf of a runner that has
already released the claim. An abort leaves rows whose objects are gone, which
is the same state a crash leaves and the state storage-first ordering already
accepts.

Idempotency comes free: a re-run selects whatever is still over budget, and
`storage.delete` is idempotent on its own, so an interrupted run is finished by
the next one rather than repaired by it.

### `clone_reference`, the fourth body

`clone_reference` fills a newly created reference with the OTUs of the one it
was cloned from. Its body is one call to `populateClonedReference`
(`@virtool/data/references/populate`) inside one step, `clone` — Python's method
name — and it reports a position: the manifest gives the OTU count up front, and
a real reference is tens of thousands of them.

**The work lives beside `references/data.ts`, not in it.** Everything the
populate does reads OTUs and writes history, and `otus/data.ts` already imports
this domain's errors, so folding it into `data.ts` would close that arrow into a
cycle. The module is also the layer `import_reference` stands on:
`prepareOtuInsertion`, the chunked bulk insert and the rollback are the port of
Python's `alot.py` and `populate_insert_only_reference`, which both tasks share,
and only the clone-specific driver on top of them is this task's.

**The manifest is a snapshot, not a pointer.** `createReference` writes every
OTU the source held at the moment the clone was requested, mapped to the version
it stood at, and each OTU is reconstructed to that version through
`patchOtusToVersions`. Editing the source while the task runs cannot change what
lands. An OTU the manifest names that history cannot produce is a
`ReferenceManifestError` and fails the task — the entry is proof the OTU existed
at that version, so a miss is corrupted history rather than a routine absence,
and skipping it would publish a reference silently short of an OTU.

**A failure deletes the reference.** Everything the run committed goes in one
transaction — diffs, history, sequences, OTUs, the membership rows, and the
`legacy_references` row itself — before the error is rethrown. The user sees the
clone disappear from the list with nothing to retry. That is Python's
`_rollback_insert_only_reference`, both runners are live until the cutover, and
the two must not disagree about what a failed clone leaves behind. It is
deliberate, not an oversight to be softened into "leave it empty and let them
retry".

**An abort rolls back nothing.** A drain-time abort means the process is going
away; the runner releases the claim and another runner re-runs the body from
step zero. Rolling back there would destroy a user's reference because a pod
restarted. The signal is checked between chunks and rethrown untranslated.

**A re-run clears before it writes.** The ids are minted fresh on every attempt,
so a reclaimed run would otherwise land a second complete set of OTUs beside the
first — silently, since neither set is malformed and nothing links the two. The
clear is the rollback's deletions minus the reference row. The two paths it has
to cover fall out of that: a rollback took the reference with it, so a re-run
after an accepted failure finds nothing to clone into and fails immediately;
an ungraceful exit left the reference, and the clear is what makes the re-run
land exactly one copy.

**A chunk is patched, prepared and committed before the next is read**, a
thousand OTUs at a time, so peak memory is bounded by the chunk rather than by
the reference. A chunk carries whole OTUs: `position` counts a sequence within
its OTU, and splitting one across two inserts would start its second half's
count at zero and reorder it — which misapplies every diff that addresses an
isolate's sequence list by index. The prepare loop yields the event loop between
chunks, because a deep copy and reshape of a thousand documents is a synchronous
stretch long enough to starve the heartbeat and get the task reclaimed out from
under itself.

**The progress split is Python's.** Patching runs to `1/1.3` of the bar and the
insert covers the remaining ~23%, which is what Python's `headroom = int(count *
0.3)` leaves. The two runners' progress is compared during the cutover, so the
ratio is reproduced rather than rounded off.

**Ids are minted without a collision check**, exactly as Python's are: the unique
constraints on `legacy_otus.id` and `legacy_sequences.id` are what a collision
fails the task on, and a check would cost a query per id against a table this
path is writing tens of thousands of rows into. They stay the mixed-case
62-character alphabet every id written from this side uses, where Python's
`random_alphanumeric` defaults to lowercase-only 36. Nothing keys on the case —
the columns are `VARCHAR` and the ids Mongo held were mixed-case — and the wider
alphabet is the safer of the two against the collision neither side checks for.
`randomId(length)` in `otus/data.ts` is the one generator: 8 characters for the
OTU, 12 for its isolates and sequences.

The reshaping is Python's, term for term. Each cloned OTU takes the reference's
own `created_at` rather than the instant the task ran, `imported: true`,
`version: 0`, a `remote.id` naming the OTU it came from, and a `lower_name`
derived from its name. Each isolate is pruned to `default`, `id`, `sequences`,
`source_type` and `source_name`, dropping whatever an older Virtool wrote onto
it. Each sequence keeps its accession, takes a `remote.id` naming its source, and
the sequences are then lifted out of their isolates — `legacy_otus.data` never
holds them. `verify` runs while they are still embedded, and its report is stored
on the document as `issues` alongside `verified`. That stored report is this
side's camelCase `OtuIssueReport` where Python's is snake_case; nothing on either
side reads it, both recompute `verify` at read time, so the divergence is inert
and a second snake_case report would be a second declaration of a shape the
contract already owns.

The history is one `legacy_history` row per OTU with `method_name = "clone"`,
`otu_version = "0"` and a NULL `index_id`, and one `legacy_history_diff` row
holding `diff(null, document)` — a dictdiffer diff against nothing, not the bare
document. The diff is composed against the OTU as it will be stored, isolates
already emptied of their sequences, which is what Python does; a diff taken from
the joined document would describe a document no row holds. The rows are paired
to their diffs by `legacy_id` rather than by the order the insert returned.

### `sweep_blast`, the fifth body

`sweep_blast` advances every outstanding NuVs BLAST search against NCBI. Its
body is one call to `sweepBlasts` (`@virtool/data/blast/data`) inside one step,
`sweep` — Python's method name — over the URL API client in
`@virtool/data/blast/ncbi`. It reports no progress: the row count is not known
until the select returns and each row takes a single round trip, so there is no
position worth publishing. What a user watches is the BLAST panel, which the
sweep's own `analyses` frames drive.

It is the only task on a **thirty-second** period. Every other periodic type
runs at ten minutes or longer, and the difference is what the row is: a
`nuvs_blast` row is a button somebody pressed a moment ago and is now watching a
spinner for.

**The row is the whole state machine.** There is no queue and no per-search
timer. Each sweep reads every row that is `ready = false AND error IS NULL` and
decides from the row itself what it needs:

| Row | What the sweep does |
| --- | --- |
| `rid IS NULL` | submits the contig's sequence, stores the RID |
| `rid` set | asks NCBI for the status, stores the result when ready |
| older than 30 minutes | records a timeout on the row's `error` |
| `interval` not yet elapsed since `last_checked_at` | nothing |

The read is unbounded and deliberately so: it selects the searches users are
sitting in front of, which is bounded by how many people clicked BLAST in the
last half hour rather than by how much history the database holds. `task_id` is
never read or written — the sweep does not filter on it, and neither does
Python's.

**Two concurrency caps, not one.** NCBI polices new submissions far more
closely than status checks, so submissions run one at a time and checks three at
a time, in two pools that run together. A row's kind picks its pool, so the two
never contend and a slow submission cannot starve the checks. Raising the
submission cap is a conversation with NCBI, not a tuning exercise.

**A failed advance backs its own row off and nothing else.** A row that throws
against NCBI is logged and stamped with `interval = min((interval ?? 3) + 5,
75)` and a fresh `last_checked_at`. Without that stamp the failure would write
nothing at all, and the next sweep would retry the row thirty seconds later, and
again, for the whole half hour it has left — turning an NCBI outage into thirty
minutes of hammering. Both pools drain before either rejection surfaces, so one
row's failure cannot abandon another mid-write.

**Both writes are guarded against a re-BLAST.** Re-BLASTing a contig deletes its
row and inserts a replacement, so an answer obtained from NCBI may belong to a
search nobody is waiting for by the time it arrives. A submission lands only
`WHERE id = :id AND rid IS NULL`; a result lands only `WHERE id = :id AND rid =
:the_rid_checked`. A zero row count is logged and dropped rather than forced. For
the same reason an **expired row is addressed by primary key**, never by
`(analysis_id, sequence_index)` — that pair is unique, which makes it a
tempting key and a wrong one: it would stamp the timeout on the replacement.

**A successful submission does not advance `interval`**, only `last_checked_at`
and `updated_at`. A submission is not a check, so the first status check lands
three seconds after it rather than eight.

**Four hardenings diverge from Python, and nothing else does.**

- An expired search is **kept and stamped with an error**, where Python deletes
  the row. A contig whose row is gone draws in the SPA as one that was never
  BLASTed, so a user who waited half an hour is told nothing happened; an
  errored one draws the message beside a retry button. The two runners disagree
  on the outcome and neither corrupts the other — an errored row is invisible to
  both sweeps' reads, and a Python sweep that gets there first only does what
  this side used to. There is deliberately **no cleanup for errored rows**: they
  are already permanent for a failed or unreadable search, they cost a row each,
  re-BLASTing the contig replaces one, and deleting the analysis cascades.
- `Status=FAILED` and `Status=UNKNOWN` set `error`. Python tests only for the
  absence of `Status=WAITING`, so it treats both as ready, fetches a result that
  does not exist and stores an empty one — which the SPA draws as "No BLAST hits
  found", indistinguishable from a real empty answer and with no retry offered.
- The result fetch checks its HTTP status. Python reads the body whatever the
  status and hands it to a zip reader, so an NCBI refusal becomes a `BadZipFile`
  and is recorded as `"Unable to interpret NCBI result"` — a permanent error on
  the row for what was a transient outage. Here a refusal is a refusal, and the
  row backs off.
- Every request carries an `AbortSignal.timeout`. Python passes no deadline at
  all, so a hung connection holds the lease until it expires and the reclaim
  opens a second hung connection behind the first.

The RID is still screen-scraped out of an HTML comment, which is the only
channel NCBI publishes it on. It throws in two places — a body with no
`QBlastInfoBegin` comment, and a comment with no `RID =` line — and neither is
defended against, because the per-row back-off is what contains the fragility.

**A frame goes out on a terminal transition only**: RID stored, result stored,
error set — by a failed check or by expiry. Never on an interval bump. A pending search is
checked as often as every three seconds, and every BLAST panel on screen holds
its own analysis query, so a frame per bump is a full analysis refetch in every
connected browser for a change no larger than a countdown.
`analyses.updated_at` is still bumped on every outcome, matching Python, so the
two writers agree on the column even where they differ on the frame.

Idempotency comes from the guards. A body restarted from step zero re-reads the
rows and re-advances them; a submission whose write already committed finds a
RID in place and discards the one it just obtained, and a result whose write
already committed finds `ready = true` and never selects the row at all. Two
sweeps running at once — which a duplicate spawn would produce — submit the same
sequence twice and discard the loser's RID rather than corrupting the row.

**The row-creating endpoint is not ported.** `blastNuvs`
(`@virtool/data/analyses/data`) already serves it from this side, inserting the
pending row and emitting the first frame; the sweep is the only thing that
advances what it inserts.

### `import_reference`, the sixth body

`import_reference` fills a newly created reference with the OTUs of a file the
user uploaded. Its body is one step, `import_reference` — Python's method name —
which resolves the upload, parses it, and hands the documents to
`populateImportedReference` (`@virtool/data/references/populate`). It reports a
position: the parsed file gives the OTU count up front.

**The body reads the file; the data layer only writes rows.** `install_hmms`
established this and the import follows it — gzip, SQLite and the two upload
formats live in `apps/tasks`, and `populateImportedReference` takes an
already-parsed `ReferenceSourceData`. Pushing the parsing down would put
`node:sqlite` and a decompression budget inside the package the web server
imports, for a format only this task reads.

**Two formats, dispatched on the suffix, because Python dispatches on the
suffix.** A `.json.gz` upload is inflated and `JSON.parse`d; a `.v1.sqlite` one
is spooled to a temp file and read through `openWorkflowIndex`
(`@virtool/sqlite`), whose reader and DDL are shared with the workflow index
artifact. Anything else is refused with Python's sentence rather than guessed
at — opening a JSON export as SQLite fails with a message about a corrupt
database, which tells a user nothing.

**An upload is located by `name_on_disk`, and that resolves to a key.**
`createReference` writes `name_on_disk` onto the task context rather than the
upload's id, so it is the only handle the task has;
`getUploadFileByNameOnDisk` turns it into the recorded `storage_key`, filtering
removed rows exactly as Python's `get_storage_key_by_name_on_disk` does. The
string does not locate an object and nothing composes a key from it.

**The inflation guard counts decompressed bytes.** `storage.size` reports the
compressed figure and so says nothing about what a file expands to. The count is
of bytes leaving the gunzip stream, capped at 512 MiB — twenty times the largest
reference seen in production, and low enough that a gzip bomb is named as one
rather than surfacing as `ERR_STRING_TOO_LONG` from a `JSON.parse` that got that
far.

**Both `_id` and `id` are accepted for an OTU and a sequence.** The JSON export
spells them `_id`; the SQLite reader yields `id`. Python reconciles the two with
a pydantic alias plus `allow_population_by_field_name`, and
`ReferenceSourceDataSchema` (`@virtool/contracts`) reproduces that, normalising
onto `_id` because the stored document is Mongo-shaped. An isolate's id is
plain `id` on both sides and needs no alias.

**The four duplicate checks run in one pass, where Python runs four
validators.** Pydantic stops at the first that raises, so a file with two
problems is fixed and re-uploaded only to fail on the next; reporting all four
at once is strictly more useful and changes no predicate. The quirks are
inherited deliberately — the name check compares case-insensitively but reports
the name as written, isolate ids collide only within their own OTU, and sequence
ids collide across the whole file. `data_type` admits `genome` alone, because
Python's `ReferenceDataType` has one member and the looser side would accept a
file the other refuses while both runners are live.

**A validation failure is summarised, never dumped.** `tasks.error` is rendered
into a popover, and a raw `ZodError` over a file with thousands of OTUs is
unbounded. The message names the first few problems and counts off the rest.

**Nothing is rolled back.** A failed import leaves whatever it committed, and
the reference with it, as `create_index` and every workflow leave their
half-built resources. `populateImportedReference` clears the reference's
contents at the top of every run, which is what makes a reclaimed task's re-run
from step zero clean, so a rollback would buy nothing the clearing does not
already give.

### Frames are the framework's, never a body's

A body never emits. `updateTaskProgress`, `completeTask` and `failTask` publish
the `tasks` frames, and they are reached only through the framework. A body that
called `emit` would publish a frame for a row it may no longer hold.

### Every body must be idempotent

A reclaimed task re-runs from step zero and nothing records which steps already
ran. `refresh_hmms` is idempotent by construction — it reads the manifest and
overwrites the status singleton, so a second run leaves what the first left —
and its test asserts that rather than assuming it. A body that cannot tolerate
re-entry keys its own idempotency off `taskId`.

### Testing a body

Two projects, both node, both against `createTestDatabase()`:

- **`@virtool/data`** covers the domain function directly — the release is
  stored, an unreachable host records the error and rethrows, and a manifest
  naming no release against a status row holding none returns `null` rather
  than reading through the absent release.
- **`apps/tasks`** covers the body end to end: insert the row, `acquireTask`,
  `runTask`, then assert the outcome, the row and the frames. The runner loop
  is not involved, so a body's test does not wait on a poll interval.

The manifest fetch is stubbed with `vi.stubGlobal("fetch", ...)` and
`vi.unstubAllGlobals()` in `afterEach`. There is no HTTP interception library
here, and there should not be one: the boundary is a single global.

The timeout is asserted by capturing the `signal` the body passed and checking
that an abort surfaces as `HmmReleaseError`. Waiting the real ten seconds out
proves the same thing and costs ten seconds.

A periodic task's row is inserted directly rather than through `createTask`,
whose `TaskType` union lists only the four the web app spawns. Spawning the
periodic ones is the spawner's job.

## Claiming, leases and fencing

A claim is a lease with a deadline, and the deadline is encoded on
`acquired_at` itself: a claim is live while `acquired_at` is within
`TASK_LEASE_SECONDS` of now, and renewing it is a write to that same column.
There is no lease column, no expiry column and no DDL — the `tasks` table is
Python's, owned through Alembic, and Python still writes it.

| Constant | Value | Meaning |
| --- | --- | --- |
| `TASK_LEASE_SECONDS` | 300 | How long a claim survives without a heartbeat. |
| `TASK_HEARTBEAT_SECONDS` | 60 | How often the holder should renew it. |

Five to one is the ratio Solid Queue and Sidekiq both settled on: four
consecutive heartbeats can be lost — a GC pause, a blocked event loop, a brief
partition — before live work becomes claimable by someone else.

### Reclaim is part of the claim

`acquireTask` matches a task that is unclaimed **or** whose lease has run out,
as one disjunction in one statement. That is graphile-worker's shape, and it
buys three things: no background timer to schedule, nothing to keep alive when
the fleet is idle, and no window between a sweep marking a row free and a
claimer taking it. The queue heals as a side effect of ordinary work.

**There is no reclaim timer, and adding one would be a second loop doing what
the claim already does.** `reclaimExpiredLeases` still ships as its own query,
with nothing calling it on a running fleet: it exists for the cutover, whose last
step widens the `ts-` scope below to recover what Python was mid-flight on when
its deployment was deleted. By then there is no claim left to fold that sweep
into.

Two things about the predicate are load-bearing:

- **Python's `progress = 0` term is gone.** It was there to avoid re-running
  partially-finished work, but a row worth reclaiming has almost always reported
  progress — so the term excluded precisely the rows a reclaim exists for.
- **The whole predicate is repeated as the outer `UPDATE`'s guard.** The
  candidate is chosen by a subquery under `FOR UPDATE SKIP LOCKED`; under Read
  Committed an updater that blocks on a row re-evaluates only its own `WHERE`
  when the lock clears, never the subquery that chose the row. Without the
  repeat, a claimer queued behind the winner overwrites the winner's claim. It
  has to be the *whole* disjunction — an `acquired_at IS NULL` term alone passes
  for a row that was reclaimed a moment ago, which is not why it was chosen.

### `ts-` scoping is the drain assumption, enforced

Every query that takes work back off a runner is scoped to a `runner_id`
beginning `ts-`, which is what `buildRunnerId()` mints (`ts-{hostname}-{pid}`;
Python uses `{hostname}-{pid}`).

Python never renews `acquired_at`. A task it claimed and has been working for
longer than the lease is therefore indistinguishable from an abandoned one, and
a reclaimer that could see it would pull live work out from under the Python
runner. Scoping at the query level makes the drain assumption enforceable
rather than a note in a runbook, which is why there is deliberately **no
configuration flag to widen it**. Widening happens once Python runs no tasks at
all, as an edit here.

### Every write a runner makes is fenced

`completeTask`, `failTask`, `updateTaskProgress` and `releaseTask` all guard on
`runner_id` and `complete = false`, and return `false` when they match nothing.
A runner that stalled past its lease and woke to find the task reassigned can
therefore write nothing at all — it cannot finish, fail, advance or release a
task someone else now owns.

`renewLeases` is the channel that tells it so. It renews conditionally and
returns the ids it actually renewed, so a caller diffs the result against what
it asked for and abandons the difference. A partial result is the normal
outcome, not an error, which is why it reports rather than throwing.

Failure is terminal here, and that is a deliberate divergence: `failTask` sets
`complete` as well as `error`, where Python's failure path writes `error` alone
and leaves `complete` false — stranding the row outside both halves of its own
`get_counts`.

Every timestamp write is `timezone('utc', clock_timestamp())`. `now()` is the
transaction's start time and is frozen for its whole length, which on a
heartbeat back-dates the lease by however long the transaction has already
run — the difference between a renewed lease and one another runner is free to
take. The `timezone('utc', ...)` wrapper is explicit and so immune to the
session's `TimeZone`, which `localtimestamp` is not.

### The data layer publishes every `tasks` frame

`updateTaskProgress`, `completeTask` and `failTask` each emit one `tasks`
frame, and `createPeriodicTask` emits one `create` frame after its transaction
commits. The framework, the runner and the spawn loop emit none — there is one
place a `tasks` row changes, so there is one place the frame comes from.

Nothing else emits. `acquireTask`, `renewLeases`, `releaseTask`,
`releaseRunnerClaims` and `reclaimExpiredLeases` are all silent: a claim, a
release and a reclaim each leave the row in the state a client last saw it in,
and a heartbeat every minute per running task would cost every connected
browser a refetch for a timestamp no view renders.

`createTask` is silent too, and that asymmetry with `createPeriodicTask` is
Python's: `tasks.db.create` emits nothing, and `create_periodic` emits by hand
after committing. It costs nothing, because every `createTask` call site is a
request the SPA is already awaiting a response to; a periodic spawn has no
client waiting on it.

**A guarded write that returns `false` emits nothing.** A frame for a change
that did not happen costs every browser a refetch and announces a state the row
is not in.

These functions take `Db` rather than `DbOrTx`, which is what keeps the frame
honest. `emit` publishes over the emitter's own pooled connection, not the
caller's, so a call nested in an open transaction would put the frame on the
wire before the row it describes had committed — the SPA would refetch the old
state and then get no second frame. Typing them `Db` makes that unrepresentable
instead of documenting it. If a task body ever genuinely needs a completion
atomic with a final domain write, widening the parameter is a one-line change
that has to answer the ordering question at the same time.

## The spawner

`createTaskSpawner` in `apps/tasks/src/spawner.ts`, over the schedule in
`apps/tasks/src/tasks/periodic.ts` and `createPeriodicTask` in
`packages/data/src/tasks/data.ts`.

It **only ever inserts.** It never claims, updates or completes a task; that is
the runner's half of this process.

### It runs beside Python's spawner, and the lock is the whole design

This is the half that goes to production *first*, while Python's API replicas
are still running `PeriodicTaskSpawner`. Both insert into the same `tasks`
table, five of the six types in common — `cleanup_sessions` is this side's
alone, Python having deleted the class. There are already several Python
spawners racing each
other across replicas — the advisory lock is what makes that safe, and this
process joins as one more participant in a protocol that already exists.

Its correctness has one observable definition: **no duplicate rows appear.** If
the two sides stop excluding each other nothing errors, nothing logs and
nothing alerts — both simply spawn, and the fleet quietly runs every periodic
task twice.

So the lock is not an implementation detail to be improved:

- **`pg_try_advisory_xact_lock(hashtext('<task name>'))`, computed in SQL.**
  Python emits `hashtext($1)` from
  `func.pg_try_advisory_xact_lock(func.hashtext(task_class.name))`. Hashing in
  TypeScript and passing a literal `bigint`, namespacing the key
  (`periodic:sweep_blast`), substituting another hash, or reaching for the
  two-argument `(int4, int4)` form — which is a *different lock namespace* —
  each silently stops excluding Python.
- **Transaction-scoped, never session-level.** `pg_try_advisory_lock` survives
  rollback, is reentrant so two logical spawners sharing one pooled connection
  do not exclude each other, and PgBouncer lists it as never supported under
  transaction pooling.
- **The lock, the recency check and the insert are one transaction**, and it is
  one transaction *per task name per tick* — not one spanning them all, which
  would hold every lock for the length of the whole tick.
- **`try_` never blocks.** `false` means another spawner is handling this name
  this tick: record `skipped_locked`, log at debug, move on. No retry, no
  backoff, no escalation to a blocking lock.

`hashtext` returns a signed **int4**, so the real keyspace is 2³² rather than
the 2⁶⁴ the advisory-lock signature implies, and the function is undocumented
by deliberate policy and has changed behaviour across major versions. At
Virtool's key population — six task names plus one `index_build:{id}` per
reference, sharing one namespace — a collision is ~10⁻⁵, and every call site is
a `try_` lock, so it degrades to a spurious skip rather than to corruption.
Widening the hash would break exclusion with Python, which is the entire point.
Accept the keyspace.

### A spawn waits on outstanding work as well as on the window

Two things suppress a spawn, and a row satisfying either is enough:

- **A row of the type that is still active** — `complete = false AND error IS
  NULL` — **whatever its age.** This is the gate that bounds the backlog.
- **Any row of the type with `created_at > now - interval`**, whatever its
  state: complete, errored, or neither. This is the window, and it paces a type
  whose runs finish quickly.

The first is a deliberate divergence from Python, which gates on recency alone.
Python's rule keeps inserting once the last row ages out of the window however
wedged the runner is — `sweep_blast` alone is a row every thirty seconds — so a
fleet that comes back from an outage finds a pile of identical periodic tasks
to drain instead of one. Gating on outstanding work holds it at one row per
type, and the recovering runner drains one task per type.

**Active, not merely incomplete, is what blocks.** A Python failure writes
`error` and leaves `complete` false, so a rule reading `complete` alone would
leave every type Python has ever failed blocked for good, silently — a
suppressed spawn is the ordinary steady state and looks like nothing at all. A
stale claim *does* block, because a reclaim will run it and a second row
alongside would be the duplicate the gate exists to avoid.

**Diverging this way cannot produce a duplicate while Python's spawner is
live.** The direction is what matters: this side only ever declines a spawn
Python's rule would have made, so Python's looser predicate sets the effective
rate until its spawner is deleted, and the pile-up it is responsible for goes
with it. The reverse — narrowing what counts as suppressing, so this side
spawns where Python would not — is what produces duplicates, and is why the
window still counts complete and errored rows.

The window is `timezone('utc', clock_timestamp()) - make_interval(...)`, and
the rows are inserted with `timezone('utc', clock_timestamp())` too. The
columns are naive UTC and nothing sets the session `TimeZone`, so a window
built from a `timestamptz` — a JavaScript `Date`, or `now()` — is compared
through whatever zone the session happens to carry, and the result is a silent
hour-scale offset: the window is either always open (a spawn every tick) or
never open (the task stops running). `clock_timestamp()` rather than `now()`,
which freezes at transaction start and back-dates the window by the
transaction's age.

### The interval is a suppression window; the tick is 30 seconds

| type | interval |
| --- | --- |
| `sweep_blast` | 30 s |
| `refresh_hmms` | 600 s |
| `timeout_jobs` | 600 s |
| `evict_caches_lru` | 3600 s |
| `cleanup_sessions` | 3600 s |
| `reap_orphaned_uploads` | 86400 s |

Every figure but `cleanup_sessions` is Python's. That one is the only free
choice on the list — `SessionCleanupTask` was written, never registered, and
has since been deleted from the Python repo, so no expired `sessions` row has
ever been deleted in production and there is no cadence to match. Hourly,
because correctness never waits on the sweep: `verify.ts` and the reset path in
`core.ts` both reject an expired row on sight, so a row lingering between
sweeps is inert and the sweep is harmless when late. That removes the usual
argument for a short interval, and hourly still keeps the shortest-lived rows —
10 minute reset sessions, 60 minute no-remember ones — from outliving their
expiry by much. Daily is the defensible alternative, rejected because a day's
accumulation makes each run a larger delete for no benefit.

Python walks every registered task and then sleeps a hardcoded 30 s, whatever
the intervals are. So a type's effective period is `max(30, interval)`,
quantised to tick boundaries — and matching the *tick* matters as much as
matching the intervals, because a per-task timer firing exactly on its interval
opens its window at a different moment than Python's tick and the two then
disagree about when a window is open.

While both spawners run the shorter of the two intervals sets the effective
rate, so a divergence changes production cadence rather than failing.

This also puts `sweep_blast` — a 30 s interval on a 30 s tick — right on the
boundary where a `created_at`-only dedup can admit a concurrent duplicate. The
outstanding-work gate above closes that on this side; Python's spawner keeps
the defect until it is deleted.

**Register nothing the runner cannot claim.** A type belongs on this list only
once `taskRegistry` carries a handler for it. The runner filters its claim on
the registry's keys, so a registration without one spawns a row that is never
acquired, never fails and never completes: it sits queued, counted against the
queue gauges, with nothing logging why. The outstanding-work gate holds that at
one row per type rather than a backlog, which makes the mistake survivable
rather than invisible — but a test checks the two lists against each other so
it does not happen at all.

`PERIODIC_TASKS` is pinned by a second test to exactly these six, so a seventh
is a deliberate act rather than a line someone appends.

### The loop

`start()` logs one line naming the schedule and its intervals; each tick walks
`PERIODIC_TASKS` in registration order, recording `spawned`, `skipped_locked`
or `not_due` through `recordSpawn` and logging a spawn at info with the row id.

**A failure on one type does not cost the rest of the tick, or the loop.** The
types are independent — a `sweep_blast` that cannot be inserted is no reason
for `refresh_hmms` to go unconsidered for another thirty seconds — and a
crash-looping spawner is strictly worse than a tick that partly failed. A
failed type records nothing, because the counter has no error outcome.

**A non-positive interval is rejected at construction**, not per tick. Python
raises inside `create_periodic`, which is per call; checking once means a bad
schedule fails the process at startup instead of every thirty seconds forever.
An interval of zero leaves the window permanently open.

**Shutdown is stop-and-finish.** The spawner holds no work — a tick is a lock,
a read and an insert — so there is nothing to drain and no ceiling to declare:
it takes the equal share the other shutdown steps do. It is registered
*after* the runner so it stops *first* (hooks run LIFO), which means the
runner's drain is not racing a fresh row into the queue. `stop()` is
idempotent and never rejects.

## The runner

`createTaskRunner` in `apps/tasks/src/runner.ts` is the loop that claims tasks,
dispatches them, and holds their leases while they run. It returns three things
and no more: `start()`, `stop()`, and `getLastTickAt()`.

It reads no configuration, opens no pool, installs no signal handler and binds
no listener. All four are the app's — `src/index.ts` builds it from the
`AppContext` and registers `stop` as a shutdown hook.

### One task at a time, on seams built for many

Replica count is the scaling lever and it already exists. The bodies are heavy
enough — a reference import parses tens of megabytes of JSON, an HMM install
decompresses a multi-hundred-megabyte tarball — that in-process concurrency
would multiply peak memory against a pod limit rather than fill idle time. And
holding the cap at one means the cutover changes exactly one variable.

The seams for many are built anyway. In-flight tasks are a `Map`, not a nullable
single slot, and `renewLeases` renews a **set**. Raising the cap is meant to be a
change to this file, not a redesign of it.

### The claim loop

A poll every `POLL_INTERVAL_MS` (2 000, Python's interval) when idle. An
async `while` rather than a `setInterval`, so a task that runs for minutes cannot
have a second poll firing on top of it.

- **Supported types are read from the registry on every poll, never snapshotted.**
  Python snapshots `BaseTask.__subclasses__()` at construction, which holds only
  the classes already imported — so one missing import silently narrows what its
  runner can claim, with nothing anywhere to say so. Reading live costs nothing
  and removes the class of bug. An **empty** registry claims nothing at all,
  because `acquireTask` short-circuits on an empty allowed-types list.
- **A failed claim logs and continues.** A connection blip or a serialization
  failure does not earn a crash-loop, which is strictly worse than a poll that
  found nothing.
- **`getLastTickAt()` is a seam, not a consumer.** It is what a
  "has the loop ticked recently" liveness check would be built on. Nothing reads
  it: `GET /health/live` is deliberately static, because a liveness probe that
  can fail restarts the fleet and kills every task in flight.
- A poll that resolves **after** the drain has begun releases its claim instead
  of dispatching it. Starting a body with no time left to finish in is how a task
  gets killed mid-write.

### A type with no handler is failed, never released

`dispatchTask` looks the claimed row's `type` up in the registry, and **fails the
task** when it finds nothing — through `failTask`, so `complete` is set beside
`error` and the `tasks` frame that tells the UI actually goes out.

Python acquires the row, finds no class for the name, logs a warning and
*returns*. The row keeps `acquired_at` set with `complete = false` and
`error = NULL`: invisible to every consumer, counted as running forever by
`get_counts`, and drawn as a progress bar that never moves. It is the documented
cause of the task runner HPA's abandoned KEDA trigger.

Releasing instead is no better. An unknown row is claimable by construction, so
it returns on the very next poll and hot-loops for good, still surfacing nothing.
Failing is the only outcome a user can see.

The claim already filters on the registry's keys, so this branch should be
unreachable — which is exactly why it is a branch rather than an assumption. It
lives in its own exported function because a test cannot get a claim of an
unknown type out of the claim query, and that test is the one worth having.

### The heartbeat

`renewLeases` for every in-flight task every `TASK_HEARTBEAT_SECONDS` against
the `TASK_LEASE_SECONDS` lease, on a `setInterval` that is **`.unref()`'d** — a
heartbeat must never be the reason the process stays alive. A beat still in
flight when the next fires is skipped rather than stacked.

A failed renewal logs at `warn` and retries on the next beat; it never touches
the running task. Four beats of headroom exist precisely so one blip is
survivable.

`renewLeases` reports the ids it renewed, and the difference is what has been
**fenced** — the lease expired and another runner owns the task. The runner
aborts that task's signal, which is how the body learns to stop working on
something it no longer holds. `runTask` then renews and checks the claim before
its cleanup and reports `fenced`, so nothing is written and nothing is released.

**Event-loop starvation is the real hazard.** A synchronous block longer than the
lease starves the timer, the lease expires, and another runner claims work that
is still running — Kleppmann's garbage-collection pause in Node form. The work is
overwhelmingly I/O-bound, so the beat measures how late it ran and logs above
`HEARTBEAT_LAG_WARN_MS`. That tripwire is what would justify moving the heartbeat
onto a worker thread, which costs a second Postgres connection per replica and a
duplicated database handle inside it. **The one genuinely CPU-heavy stretch is
bulk OTU preparation during reference import and clone, and that loop must
yield** — chunk it and `await` between chunks. The constraint belongs to those
task bodies; the consequence lands here.

### Shutdown is drain, then release

`stop()` is the whole sequence, registered as a single shutdown hook. The
controller owns everything around it — `process.exitCode`, the listener, the
pool, the Sentry flush, and the guard against a second signal.

1. Stop claiming. The loop observes it and its poll wait is woken rather than
   waited out.
2. Wait for the in-flight task, up to `VT_TASKS_DRAIN_TIMEOUT` less the abort
   grace and the release reserve.
3. If the window expires, abort what is still running so a cooperative body stops
   instead of working on past the release.
4. **Wait for it to actually stop**, up to the abort grace.
5. Stop the heartbeat — *after* the drain, because a task still working needs its
   lease held.
6. `releaseRunnerClaims`, clearing `acquired_at` and `runner_id`.

**Step 4 is not politeness, and skipping it skips the body's `cleanup`.** The
abort only *signals*. `runTask` renews the lease to confirm it still holds the
task before tearing anything down, so a release landing on top of the abort
clears `runner_id` under a body that is still unwinding: the renewal matches
nothing, the run reports `fenced`, and the cleanup the abort path is supposed to
run is skipped without a word. Waiting keeps the claim alive long enough for that
ownership question to be answered truthfully. A cooperative body unwinds in
milliseconds, so the grace is only ever spent on one that ignores its signal —
and for that one the release is the correct backstop.

The three phases share the one ceiling the hook declares, and the grace is
**clamped rather than validated**: a drain window too small to hold it degrades
to a shorter grace instead of overrunning the ceiling and being abandoned
mid-release.

Draining to completion is not on offer at any grace period we can set: these
tasks run for minutes, and a cluster autoscaler force-removes a pod well before
an hour whatever the field says. So the window is bounded and what follows it is
a release — which is the point of this shape. A released task is claimable again
in milliseconds; an abandoned one sits out the full `TASK_LEASE_SECONDS` of dead
time.

**The reserve is why the drain window is not the whole hook budget.** A drain
that spent all of it waiting would be abandoned mid-`UPDATE` and leave the claims
it was handing back exactly where a hard kill would have.

`stop()` is idempotent — a second call returns the first one's promise rather
than starting a second drain, which would release a claim the first pass is still
draining — and it **never rejects**. Every failure inside it is logged, because
the only move left to a caller winding the process down is to carry on winding it
down, and a throw would take the steps after it with it.

An `aborted` outcome from `runTask` is released for the same reason: the row
still carries this runner's claim and is not complete, so handing it back beats
letting it sit out the lease. `fenced` is not this runner's to release, and
`completed` and `failed` are terminal.
