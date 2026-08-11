# Tasks

`apps/tasks` (`@virtool/tasks`) is Virtool's task service: a long-lived Node
process that spawns periodic tasks and runs them. It is the TypeScript port of
Python's `task_runner`, and it ships as `ghcr.io/virtool/tasks` on Alpine.

It is deliberately small in surface. It serves no API, has no Service and no
ingress, and the only HTTP it speaks is three routes on a probe listener. Its
work reaches the outside world through Postgres and object storage.

## One process, two halves

The spawner and the runner are **one binary**, not two.

The spawner inserts the scheduled tasks; the runner claims and executes them.
Each is turned off independently:

| Variable | Default | Effect when `false` |
| --- | --- | --- |
| `VT_TASKS_SPAWN_ENABLED` | `true` | The process spawns no periodic tasks. |
| `VT_TASKS_CLAIM_ENABLED` | `true` | The process claims and runs nothing. |

Both default to `true` because an omitted flag has to fail toward a working
fleet. A default of `false` would make a deployment that never set the key a
silent no-op — a pod that starts, passes every probe, and does nothing at all.

The two flags are what decouple the halves' rollouts, which is the whole reason
separate binaries were ever considered. The cutover from Python is:

1. Deploy with `VT_TASKS_CLAIM_ENABLED=false`. The TypeScript spawner runs in
   production while Python still executes what it spawns.
2. Stop Python's spawner and runner.
3. Flip `VT_TASKS_CLAIM_ENABLED` to `true`.

One image and one Deployment carry that whole sequence. Don't reintroduce a
second binary to get the same effect — a mode flag on one artifact is the same
decoupling with half the pipeline.

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
	onShutdown: (name: string, hook: () => Promise<void>) => void;
	setReady: (ready: boolean) => void;
};
```

`db`, `client` and `storage` are passed into `@virtool/data` and
`@virtool/storage` functions as arguments, exactly as they are in `apps/web`.
Nothing imports a module-scope handle, because there is none to import.

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
| `VT_TASKS_SHUTDOWN_TIMEOUT` | `30` | **Seconds.** Must stay under the grace period — see below. |
| `VT_TASKS_CLAIM_ENABLED` | `true` | |
| `VT_TASKS_SPAWN_ENABLED` | `true` | |
| `VT_METRICS_TOKEN` | unset | Unset leaves `/metrics` reporting 404. |
| `VT_SENTRY_DSN` | unset | Unset disables Sentry. |
| `VT_STORAGE_BACKEND` | — | Required, `s3` or `azure`. |
| `VT_STORAGE_S3_*` / `VT_STORAGE_AZURE_*` | — | Same names and rules as `apps/web`. |

The schema is zod, in `src/config.ts`, and `TASKS_ENV_KEYS` is derived from it
rather than listed by hand — a key missing from that list would silently lose
its file variant.

Booleans are spelled out as an enum of `true` / `false` / `1` / `0` rather than
left to `z.coerce.boolean()`, which is a plain truthiness cast: it reads the
string `"false"` as `true`, so the one value a deployment is most likely to
write in order to turn something off would turn it on instead. An injected
empty string reads as unset everywhere, which is what deployment tooling emits
for a value it has nothing to put in.

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
unprefixed so off-the-shelf Node dashboards match — plus `virtool_app_info` and
the task series below. The `virtool_http_*` series are deliberately absent:
they are web-specific, their buckets top out at 10 s, and this process serves
nothing but probes.

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
- **The queue gauges are the spawner half's.** `bootstrap` builds the reader
  only when `spawnEnabled`, and the handler skips the refresh when it is
  absent, so a claim-only deployment's scrapes touch the database not at all.
  Every replica carries a runner; a reader wired unconditionally would have N
  replicas each scanning the same table to publish N copies of one number.
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
is **divided rather than pooled**: every step, each hook included, gets an
equal share of the time still left when it starts, and is abandoned once that
share is spent. A step that finishes early hands its remainder on. Awaiting the
whole sequence against a single deadline instead would let one stuck socket eat
the budget and take the pool drain and the Sentry flush with it — losing the
record of the failure exactly when there was one to keep. An abandoned step is
not cancelled, so the process may still have to be reaped; what the division
buys is that everything after it still runs.

Then `process.exitCode` is set — `0` only when every step ran, `1` if any of
them failed or the backstop fired first — and the loop drains. A failed
shutdown that exited `0` would be indistinguishable from a clean one, and an
undrained pool would pass unnoticed through every rollout.

A **second signal is logged and ignored.** Re-entering would run every hook
twice and close the pool out from under the first pass.

The backstop is `.unref()`'d. Without that it holds the event loop open for its
full budget on an otherwise clean shutdown, so a process that finished winding
down in 200 ms would still sit there for thirty seconds.

`VT_TASKS_SHUTDOWN_TIMEOUT` must stay strictly under
`terminationGracePeriodSeconds`, which covers `preStop` *and* shutdown
combined. The manifests use a 60 s grace period behind a 10 s `preStop` sleep,
leaving 50 s; the 30 s default is comfortably inside it. Set it too high and
SIGKILL lands before the backstop fires, and the process gets neither a clean
shutdown nor a controlled failure.

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
layer, and the dispatch loops land on top of it, and each fills in its section
here in its own commit:

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
- **The task bodies** — `apps/tasks/src/tasks/<type>.ts`, registered with the
  runner's registry. The shell lives with its runtime, the way `functions.ts`
  lives with the web app.

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

`reclaimExpiredLeases` still ships as its own query. Nothing needs to call it on
a running fleet; it exists for the cutover, where a deployment may be spawning
tasks with `VT_TASKS_CLAIM_ENABLED=false` and so never running a claim to heal
anything.

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
frame. The framework and the runner emit none — there is one place a `tasks`
row changes, so there is one place the frame comes from.

Nothing else emits. `acquireTask`, `renewLeases`, `releaseTask`,
`releaseRunnerClaims` and `reclaimExpiredLeases` are all silent: a claim, a
release and a reclaim each leave the row in the state a client last saw it in,
and a heartbeat every minute per running task would cost every connected
browser a refetch for a timestamp no view renders.

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
