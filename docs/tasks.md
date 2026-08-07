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
   frames the framework publishes never reach the SPA.
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
unprefixed so off-the-shelf Node dashboards match — plus `virtool_app_info`.
Nothing else yet. The `virtool_http_*` series are web-specific: their buckets
top out at 10 s, and this process serves nothing but probes. Task and queue
series belong to the issues that add the loops.

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

### The version label

`virtool_app_info{version}` comes from a JSON import of the app's own
`package.json`, passed explicitly into `bootstrap`.

`apps/web` reads `__APP_VERSION__`, which is a **Vite** `define` and simply
does not exist in a bundled Node app: the label would render `undefined` with
nothing failing to say so. A JSON import is a real module value — the bundler
inlines it, `vitest` resolves it, and no ambient global is involved. It is only
*correct* in a released image because CI's `publish-ghcr` job runs
`pnpm -C ${{ matrix.workspace }} version` before the Docker build, which this
app is covered by through its publish-matrix entry.

## Shutdown

Registering a SIGTERM listener **removes Node's default exit behaviour**. From
that moment, exiting is entirely this app's responsibility.

`src/shutdown.ts` discharges that with `process.exitCode` and a natural drain,
**never `process.exit()`**. Node's own documentation is explicit that `exit()`
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

There is deliberately **no pino destination forwarding log records to Sentry**,
as `apps/web` has. That stream is written against `@sentry/tanstackstart-react`,
so bringing it here means a third copy rather than a shared one, and the SDK's
own uncaught-exception and unhandled-rejection integrations already report what
a crash needs. Code wanting a *handled* failure in Sentry calls
`Sentry.captureException` explicitly. Lift the stream into `@virtool/sentry`
before copying it.

## Testing

`apps/tasks` has its own Vitest project and its own CI job (`Test / Tasks`),
for the same reason `@virtool/data` and `@virtool/jobs-api` do: it runs against
a real Postgres testcontainer, and pulling that image does not belong in the
fast package loop. It is excluded from `Test / Packages` accordingly.

The container is **not described here**. `globalSetup` names
`@virtool/data/db/test/globalSetup`, the single definition every database-backed
suite in the repo shares, so the options cannot drift and `withReuse()` boots
one Postgres across all of them locally.

## The framework and the loops

`bootstrap` is the floor. The task framework, the claim/lease/reclaim data
layer, and the dispatch loops land on top of it, and each fills in its section
here in its own commit:

- **Framework** — `defineTask`, the step model, the percent/fraction progress
  seam, and event emission. Lives in `apps/tasks/src/framework/`: it is an
  execution shell rather than persistence, only this process ever runs a task,
  and it needs zod, which `@virtool/data` does not depend on and should not
  start to.
- **Claim, lease and reclaim** — `acquireTask`, `renewLeases`, `completeTask`,
  `failTask`, `releaseTask`, `releaseRunnerClaims`, `reclaimExpiredLeases`.
  These are pure persistence over a table both halves write, so they belong in
  `packages/data/src/tasks/data.ts`, extending the module already there.
- **The task bodies** — `apps/tasks/src/tasks/<type>.ts`, registered with the
  runner's registry. The shell lives with its runtime, the way `functions.ts`
  lives with the web app.

Note there is **no `service.ts` tier available to a task body.** `service.ts` is
the web app's orchestration layer and stays in `apps/web/src/server/<feature>/`,
unreachable from here. A body's cross-`data` orchestration goes either into
`@virtool/data` — when it is persistence plus injected external IO — or into
the handler module itself. Do not add a `service.ts` under `packages/data/`.
