# The workflow runtime

`@virtool/workflow` (`packages/workflow`) is the runtime a workflow executor
runs on: the step model, the run loop, the work directory, and the seam
that builds a run's context. It is the port of Python's
`virtool/workflow/` — `workflow.py`, `decorators.py`, `runtime/run.py` and
`runtime/path.py` — minus the three mechanisms this side deliberately does
not have: dependency injection, teardown, and lifecycle hooks.

It knows nothing about HTTP, object storage, subprocesses, or job claiming.
`runWorkflow` returns an outcome and never touches the network,
`process.exit`, or a signal handler; the job lifecycle loop owns all of
that.

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
function name it was ported from.** It is the identifier the control plane
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

`WorkflowContext` grows three more members, each added by its own issue:
`runSubprocess`, `storage` and `client`. Only `data` is
serializable-constrained; those three carry live handles by design.

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

A rejection from `onStepStart` fails the run. The control plane not knowing
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
| `VT_TIMEOUT` | `1000` |
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
and the control-plane client extend `WorkflowError` rather than `Error`, so
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
