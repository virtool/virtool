# The workflow runtime

`@virtool/workflow` (`packages/workflow`) is the runtime a workflow executor
runs on: the step model, the run loop, the work directory, the seam that
builds a run's context, and the job lifecycle loop that talks to the jobs
API. It is the port of Python's `virtool/workflow/` — `workflow.py`,
`decorators.py`, `runtime/run.py`, `runtime/path.py`, `client.py`,
`api/utils.py`, `acquire.py` and `runtime/ping.py` — minus the three
mechanisms this side deliberately does not have: dependency injection,
teardown, and lifecycle hooks.

The two halves are kept strictly apart. `runWorkflow` is the run loop: it
**returns** an outcome and never touches the network, `process.exit`, or a
signal handler. `runWorkflowApp` is the lifecycle loop that owns all of
that — claiming, heartbeating, reporting, and the exit code. It knows
nothing about object storage or subprocesses.

## The step model

A workflow is an **explicit ordered array** of steps handed to
`defineWorkflow`, which validates it and returns a `Workflow`.

```ts
export const workflow = defineWorkflow<Data, State>({
	name: "pathoscope",
	buildContext,
	createState: () => ({ hits: [] }),
	steps: [
		{
			id: "map_default_isolates",
			description: "Map reads to the default isolates.",
			run: async (context) => { ... },
		},
	],
	result: (state) => ({ hits: state.hits }),
});
```

There is no module scanning. Python's `collect()` reads a module's
`__dict__` and picks up decorated functions in definition order; bundling
and tree-shaking make that order an unsafe thing to depend on.

**A step's `id` is authored in `snake_case` and must match the Python
function name it was ported from.** It is the identifier the jobs API
stores — `POST /jobs/{jobId}/steps/{stepId}/start` takes it, and Python
sends `step.function.__name__`. Never derive it by slugifying a display
name: a ported workflow whose step ids drift changes the shape of a job's
step list at cutover.

`defineWorkflow` throws `WorkflowDefinitionError`, naming the workflow and
the offending step, when the workflow declares no steps, or a step has an
id that is not `snake_case`, an id another step already used, or an empty
description.

A step with no explicit `name` gets the title-cased id, the same way
Python's `str.title()` produces one: `map_default_isolates` becomes
`Map Default Isolates`, so a ported step keeps the label the UI already
shows for it.

## The context is eager and plain, and there is no dependency injection

Python resolves fixtures by introspecting a step function's **parameter
names** against a `ContextVar` registry, with async generators supplying
teardown through an `AsyncExitStack`. This side has none of that. A run's
context is an ordinary object, built once before the first step by a
per-workflow `buildContext`, and handed to every step:

```ts
type WorkflowContext<TData, TState> = {
	readonly data: TData;   // eagerly built, serializable
	state: TState;          // mutable cross-step scratch
	readonly job: RunJob;
	readonly workPath: string;
	readonly proc: number;
	readonly mem: number;
	readonly logger: Logger;
	readonly signal: AbortSignal;
};
```

`buildContext` is the **only** producer of `data`, and `data` is
constrained to stay serializable — no class instances, no closures, no live
handles. That constraint is what lets the deferred end-to-end test bed
express a whole run as a directory of files plus a JSON blob and hand it
straight in.

`createWorkflowContext` is the seam that enforces it. It calls the
workflow's `buildContext`, runs `assertSerializableData` on what comes
back, and assembles the context. A caller that built the context itself
would be free to skip the assertion, and the failure it catches is
otherwise invisible until that bed exists.

**Lazy or memoized accessors were rejected.** They turn the data half into
a set of closures needing a hydration step, which is the one thing the
serializable constraint exists to prevent. Cross-workflow laziness is
handled by per-workflow construction instead — NuVs' builder fetches HMMs
and create-sample's does not — not by the injection mechanism. Eager also
fails fast: a storage read that fails surfaces before step 1 rather than
forty minutes in.

`assertSerializableData` runs a `JSON.parse(JSON.stringify(x))` round trip
and reports **every path** at which the value came back changed
(`job.createdAt: Date became "1970-01-01T00:00:00.000Z"`). Hunting for the
one `Date` in a nested domain object is exactly the work this check saves. The
check is a runtime assertion only; a conditional type mapping functions and
class instances to `never` was not added, because a `TData` with any
optional field would then have to fight the type system to satisfy it.

`state` is the mutable scratch that replaces Python's `results` dict
fixture, and is **not** serializable-constrained. It holds whatever a
workflow needs between steps.

`WorkflowContext` carries the run's `client` — built before `buildContext`
runs, so a step that needs a metadata read reaches it without a second
construction path — and grows two more members, each added by its own issue:
`runSubprocess` and `storage`. Only `data` is serializable-constrained;
those three carry live handles by design.

## There is no teardown

The container is ephemeral and process exit reclaims everything. Python's
`AsyncExitStack` is not ported, and there is no `dispose` or
`Symbol.asyncDispose` layer. `createWorkPath` empties and recreates the
work directory at the start of a run and nothing removes it at the end.

Because that function unconditionally deletes its target and the target
comes from an environment variable, it refuses a blank path and one that
resolves somewhere with no parent directory. Python has no such guard.

## There are no lifecycle hooks

Python exposes ten module-level hooks — `on_workflow_start`, `on_step_start`,
`on_step_finish`, `on_result`, `on_success`, `on_cancelled`, `on_error`,
`on_terminated`, `on_failure`, `on_finish` — with a registry, concurrent
`asyncio.gather` dispatch, and a `cleanup_builtin_status_hooks()` call to stop
one run's callbacks leaking into the next. **None of it is ported.**

A survey of every production registration across `virtool` and the four
`workflow-*` repos found the whole mechanism carrying three callbacks:

| Hook | Registrations |
| --- | --- |
| `on_failure` | 4 — one per workflow, each deleting the resource it was building |
| `on_step_start` | 1 — runtime-internal, reports the step to the jobs API |
| `on_success` | 1 — runtime-internal, `POST /jobs/{id}/finish` |
| the other seven | **0** |

`on_result` is worth calling out: it has never had a registration. A workflow
uploads its result with an explicit call inside its final step, so the hook
fires into nothing.

The three real callbacks resolve without a registry:

- **`on_failure`'s deletions are gone by decision.** A failed run now leaves
  its half-built sample, subtraction, or analysis for the user to delete. The
  cleanup was best-effort anyway — it ran in the workflow process, so an OOM
  kill or a lost node skipped it and stranded the resource regardless.
- **`on_success` is redundant.** `runWorkflow` returns `RunOutcome`, so the
  caller marks the job finished on `"succeeded"` itself.
- **`on_step_start` is the only genuine one**, because it fires mid-run rather
  than at the end. It survives as `onStepStart` on `RunWorkflowOptions`: one
  optional function, no registry, no dispatch semantics.

A rejection from `onStepStart` fails the run. The jobs API not knowing
which step is executing is not a thing to continue past.

Do not reintroduce a hook registry to give a workflow a place to put teardown.
That is the same argument the no-teardown rule already answers.

## How a run ends

`runWorkflow` reports every outcome by returning a `RunOutcome`, never by
throwing:

| Outcome | `state` | `error` |
| --- | --- | --- |
| Every step completed | `succeeded` | absent |
| A step threw | `failed` | what it threw |
| `onStepStart` rejected | `failed` | what it threw |
| Aborted, `isCancelled()` | `cancelled` | absent |
| Aborted, not cancelled | `failed` | absent |

An abort with neither `isCancelled()` nor `isTerminated()` set takes the
termination path and logs `workflow terminated without sigterm`. Nothing
should be able to produce it, so the run says so rather than reporting a
plain termination.

`state` is tracked separately from `error` because a step is free to throw a
falsy value; keying the outcome off the captured error alone would read
`throw undefined` as a clean run.

## Cancellation is cooperative, and this is the one real divergence

In Python, `CancelledError` unwinds the step at its next `await`. Aborting
an `AbortSignal` in Node interrupts **nothing** — the step keeps running.

So `runWorkflow` races the in-flight step against the signal. On abort it
stops awaiting the step, logs that it was abandoned, and proceeds down the
cancellation path without waiting. That is safe because the process exits
immediately afterwards and the subprocess runner kills its process tree on
the same signal.

The abandoned step is left with a `catch` attached. Its eventual rejection
would otherwise be an unhandled rejection that takes the process down
before the caller has finished reporting the run — which is the whole point
of not waiting for it.

**An abort outranks whatever the step threw.** A step that forwards
`context.signal` to an abort-aware API rejects from that API's own abort
listener, and that listener was registered inside `step.run` — before the
run loop's — so it fires first and its rejection can win the race. Reading
that as a step failure would report a cancelled job as `error`/`failure`
and lose the cancellation entirely, so a rejection arriving while
`signal.aborted` is set takes the abort path instead.

`createRunSignals` replaces Python's `Events`. Both `cancel()` (a ping
response reported `cancelled: true`) and `terminate()` (SIGTERM) abort the
same signal; the flags are what tells the two apart afterwards.

## The job lifecycle

`runWorkflowApp` is what a workflow app's `main.ts` calls. It is the half
of the runtime that talks to the jobs API, and it runs in this order:

1. Initialise Sentry from `config.sentryDsn` and set the workflow context.
2. Create the run's signals and install the SIGTERM handler.
3. Claim a job.
4. Create the authenticated client, read the job back for its `args`, and
   create the work path — the last two concurrently.
5. Build the context through the workflow's own `buildContext`.
6. Start the ping loop, `await runWorkflow(...)`, stop the ping loop.
7. Report success, then exit.

**The SIGTERM handler is installed before the claim**, unlike Python's,
which installs it after (`run.py:274`). A pod terminated while still
polling for a job otherwise dies on Node's default handler and reports 143
rather than the 124 every other termination reports.

### Claiming: a pod learns its job id here and nowhere else

A KEDA `ScaledJob` starts a pod with no job id and no key, so `claimJob`
polls `POST /jobs/claim` — **unauthenticated**, because the key comes back
*from* the claim — every 2 s until the jobs API hands it one. The workflow
is a query parameter, not a body field, matching Python's `ClaimJobView`.

A 404 means no job is waiting and the poll continues. A connection error
warns and continues. Any other status is logged with its body and thrown.

The overall bound is the caller's `AbortSignal`, so the `VT_TIMEOUT`
deadline and a SIGTERM both land through one mechanism. `claimJob` then
**returns `null`** rather than throwing: both are ordinary outcomes, and a
caller has to tell them apart anyway to pick between exit 0 and exit 124.

The claim body carries the runner's metadata — `runnerId`
(`{hostname}-{pid}`), `mem`, `cpu`, `image`, `runtimeVersion`,
`workflowVersion` — and the step list the runner will run. Every field is
camelCase, and the shapes come from `@virtool/contracts`; nothing is
redeclared here.

`VT_IMAGE` is never set in any manifest today, so every claimed job records
`image: "unknown"`. That is Python's behaviour too, and fixing it belongs to
cutover, when two images serve one workflow name.

**The claim response carries no `args`.** Python's does not either — its
`job` fixture reads the full job back with `GET /jobs/{id}` — so this
runtime does that read once, eagerly, before the first step.

### The client

`createJobsApiClient` returns one client per run, created after the
claim. It authenticates every request with HTTP Basic as `job-{id}:{key}`,
the handle prefix the jobs API reserves for a runner.

Paths carry **no prefix**: `/jobs/claim`, `/jobs/{id}`, `/jobs/{id}/ping`,
`/jobs/{id}/steps/{stepId}/start`, `/jobs/{id}/finish`. The jobs API serves
no SPA, so nothing collides and they match Python's byte for byte. The base
URL is the cluster-internal jobs API service, never the public web origin.

Requests go through `fetch` with an explicit `undici` `Agent`, because
aiohttp's three timeouts have no single-value equivalent:

| Deadline | Value | aiohttp |
| --- | --- | --- |
| `connectTimeout` | 30 s | `sock_connect` |
| `headersTimeout` | 60 s | `sock_read` |
| `bodyTimeout` | 60 s | `sock_read` |
| `AbortSignal.timeout` | 600 s | `total` |

The overall budget alone is not equivalent — it does not bound a stalled
socket that keeps trickling bytes.

Response bodies are parsed with the zod schemas from `@virtool/contracts`;
nothing is cast. `request` is generic and public, so the finalize,
cache-register and metadata endpoints build on it rather than each
hand-rolling auth, retry and status mapping.

### Retry policy

**Five retries — six attempts — at a flat 5 s.** Python's `retry` decorator
only backs off exponentially when a caller passes a non-default
`base_delay`, and nothing does, so the observed behaviour is six attempts
spread over 25 s. Do not "improve" this into exponential backoff; the ping
timeout below is calibrated against it.

Only a `TransportError` is retried. A status the jobs API chose is never
retried — Python does not either, and repeating a 409 five times over 25 s
is a bug. That is why the two are separate classes rather than one carrying
a flag.

The retry sleep is interruptible by the run's cancellation signal, so a
cancelled run does not sit in it for 25 s before noticing. Each retry logs
at `info` and the exhaustion at `warn`.

Statuses map to named errors, all extending `JobsApiError`, which
extends `WorkflowError`:

| Status | Error |
| --- | --- |
| 400 | `BadRequestError` |
| 401 | `UnauthorizedError` |
| 403 | `ForbiddenError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 500 | `ServerError` |
| anything else | `JobsApiError`, naming the status |

The message is the JSON body's `message` key when there is one, else the
stringified JSON, else the response text, else a fixed fallback — mirroring
`api/utils.py:124-142`. Python raises a bare `ValueError` for an unmapped
status; a named error carrying the status is the improvement.

### The ping loop is the cancellation channel

`startPingLoop` sleeps 100 ms, pings, then sleeps 5 s and repeats. A
response with `cancelled: true` calls `signals.cancel()`, which aborts the
run's signal and unwinds the run loop. A runner has no other way to learn it
should stop.

Ping requests are issued with **retries disabled** and bounded by the
loop's own signal, so the loop owns the policy end to end. The second half
matters as much as the first: on a successful run nothing aborts the run's
signal, so a hung ping would otherwise hold `stop()` open for the 600 s
request budget with the finish call queued behind it — long enough for the
sweep to fail a job whose work is already done. Python's ping goes through `@retry`, so one "failure" as
its loop counts it costs 25 s of hidden retries first, and with the loop's
own five-failure budget on top the pod can go over two minutes without a
successful ping while still believing it is healthy.

Failures are counted **consecutively and reset on success**. Python's
counter never decrements (`ping.py:23,37`), so a run long enough to
accumulate six scattered blips stops pinging forever. Fixing that is in
scope here.

On the fifth consecutive failure the loop logs at `warn` — naming the
consequence, because this is otherwise silent — stops, and **lets the run
continue**. It does not cancel.

That give-up window is roughly 20 s. **The jobs API fails a running
job whose last ping is more than five minutes old**
(`Data.timeout_stalled_jobs` in `virtool/jobs/data.py`, which sweeps
`pinged_at < utcnow() - 5 minutes`). The loop must give up well inside that
window; if either number changes, they have to be compared again.

### Reporting: two calls, and deliberately no failure call

`onStepStart` posts `POST /jobs/{id}/steps/{stepId}/start` with the step's
`id`, not its display name. On a `succeeded` outcome the app posts
`POST /jobs/{id}/finish`.

There is **no failure call**. Failure is an API-side transition: a job fails
by being cancelled or by timing out on ping. The jobs API's wire contract
has no "fail" endpoint to call.

A `finish` that fails is logged at `error` and does not change the exit
code. The work is done and the outputs are written, so retrying the pod
would redo all of it; the job is left to the ping timeout instead.

### Exit codes

| Situation | Exit |
| --- | --- |
| Workflow succeeded | 0 |
| A step threw | 0 |
| Cancelled via ping | 0 |
| Claim timed out with no job | 0 |
| SIGTERM | 124 |
| Claim error, work path, or `buildContext` failed | 1 |

**A failed workflow exits 0.** The jobs API owns the failure
transition, and a non-zero exit makes the `ScaledJob` retry the pod, which
is not wanted. The failure is logged at `error` with the error as a
structured field before exiting, or it would disappear.

**124 is the orchestrator's signal for intentional termination**, which is
why SIGTERM does not simply exit 0.

`exit` is an option on `runWorkflowApp`, defaulting to `process.exit`, so a
test records the code a run arrived at rather than taking the runner down.
Sentry is flushed before it is called — `process.exit` is immediate, and a
buffered event would never leave the pod.

## Configuration

`parseWorkflowRunConfig(env)` parses the environment into a
`WorkflowRunConfig`. Every key is `VT_`-prefixed and every key also reads
from a `<KEY>_FILE` variant, resolved by `resolveFileBacked` from
`@virtool/contracts/env` — the same helper every other service uses, so the
precedence rule cannot drift. The file wins over a plain variable of the
same name, an unreadable path throws at startup, and an empty file is an
unset value.

| Key | Default |
| --- | --- |
| `VT_JOBS_API_URL` | **none — required** |
| `VT_WORK_PATH` | **none — required** |
| `VT_WORKFLOW` | none — required, parsed as `JobWorkflow` |
| `VT_MEM` | `4` |
| `VT_PROC` | `2` |
| `VT_TIMEOUT` | `1000` — **seconds**, matching Python's `asyncio.timeout` |
| `VT_IMAGE` | `"unknown"` |
| `VT_SENTRY_DSN` | unset |

Two of those are deliberate departures from Python's defaults. Python
defaults the jobs API address to `https://localhost:9950`, which in a pod
silently polls nothing and reads as an idle runner rather than a
misconfigured one; and it defaults the work path to the relative path
`temp`, which `createWorkPath` would then delete. Both are required here.

**`VT_JOBS_API_URL` is also a rename.** Python calls it
`VT_JOBS_API_CONNECTION_STRING`, but it is a base URL that a path is
appended to (`client.py` does `f"{connection_string}{path}"`), not a DSN,
and `VT_POSTGRES_URL` already settles this repo's convention in the harder
case — that one *is* a credential-bearing connection string and is still
named `_URL`. A workflow pod's manifest therefore renames the variable in
the same change that switches it to a TypeScript image. Getting that wrong
fails loudly at startup rather than quietly, which is the practical reason
this key keeps no default.

An empty string is treated as unset throughout, because deployment tooling
routinely injects one for a value it has nothing to put in — and coercing
`""` would make `VT_MEM` zero rather than four.

`parseWorkflowRunConfig` is a function the app entrypoint calls; the parsed
config is then passed on as an argument. **Nothing in the package reads
`process.env` at import time.** That is the same rule that got the old
`@virtool/config` package deleted.

## Errors and logging

`WorkflowError` is the base for everything this package throws, with
`WorkflowDefinitionError` for a malformed definition. The subprocess runner
and the jobs API client extend `WorkflowError` rather than `Error`, so
a workflow app can tell a runtime failure from anything that went wrong
inside a step.

Logging goes through `@virtool/logger`. `console.*` is banned repo-wide.
Structured fields go first and the message second
(`logger.info({ stepId }, "running workflow step")`) — never interpolate a
value into the message, which defeats the redaction list and makes records
ungreppable.

## What is not ported

- `runtime/discover.py`, the importlib file loading. TypeScript workflow
  apps are compiled entrypoints with an explicit step array.
- The `pyfixtures` dependency and everything built on it.
- `AsyncExitStack` and every teardown path.
- `hooks.py` and `runtime/hook.py` — the whole lifecycle hook mechanism,
  including `cleanup_builtin_status_hooks()` and `Hook`'s `until=` / `once=`
  options.
- `get_workflow_version`'s `VERSION`-file read (`utils.py`). There is no
  such file in a bundled `.mjs`; `runtimeVersion` and `workflowVersion` are
  passed into `runWorkflowApp` by the app, baked in at bundle time.
- `client.py`'s file transfer methods — `get_file`, `post_file`,
  `put_file`, `get_cache`, `put_cache`. Workflows now reach object storage
  directly and declare what they wrote, rather than uploading through the
  jobs API.
