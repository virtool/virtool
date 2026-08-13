# The workflow test harness

`@virtool/workflow/testing` is what every workflow test stands on. It replaces
two pieces of Python scaffolding outright:

- `virtool/workflow/pytest_plugin/` (~284 lines) — the `workflow_data` fixture,
  a `WorkflowData` dataclass seeded by `pydantic_factories`, a `StaticTime`, and
  a real `run_subprocess`.
- `tests/fixtures/workflow_api/` (~1,000 lines across seven route modules) — a
  real aiohttp `TestServer` whose route tables mutated one shared `WorkflowData`
  object in place.

There is more workflow test code than workflow source and none of it ports
mechanically, so this harness is used four times over by the workflow ports and
once more by the runtime itself.

It lives in `packages/workflow/src/testing/`, runs under node via
`packages/workflow`'s own `test` script, and **imports nothing from
`apps/web`** — which is what lets a workflow app's tests use it without
depending on the SPA.

## Factory functions, not framework magic

pytest injected fixtures by parameter name and resolved a dependency graph
between them. Vitest has no equivalent and this harness deliberately does not
build one.

- Everything is an exported factory taking explicit arguments and returning a
  value: `createJobsApiState`, `createFakeJobsApiClient`,
  `startJobsApiTestServer`, `createFakeSubprocessRunner`, `createTestStorage`,
  `createTestWorkPath`.
- Nothing is installed by import side effect, and there is no module-level
  mutable state. Vitest runs test *files* in parallel processes and tests within
  a file concurrently on request, so shared module state is a cross-test data
  race.
- Anything needing cleanup returns its disposer alongside the value, and the
  caller registers it with `onTestFinished`. There is no global `beforeEach`.
- Composition is explicit. A test that wants a seeded context over a faked jobs
  API calls both factories and wires them.

```ts
import { onTestFinished } from "vitest";
import {
	createFakeJobsApiClient,
	createFakeSample,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";

const sample = createFakeSample();
const { storage, seedSampleReads } = createTestStorage();

const seeded = await seedSampleReads(sample.id, [
	{ name: "reads_1.fq.gz", contents: "…" },
]);

const state = createJobsApiState({
	samples: new Map([
		[
			sample.id,
			{
				...sample,
				reads: seeded.map((file, id) => ({
					id,
					name: file.name,
					size: file.size,
					storageKey: file.storageKey,
				})),
			},
		],
	]),
});

const client = createFakeJobsApiClient(state);
const { path, cleanup } = await createTestWorkPath(["reads"]);

onTestFinished(cleanup);
```

## Two halves, one state object

The harness splits by what the test is actually asking.

**Workflow tests** get `createFakeJobsApiClient(state)` and exercise no HTTP. A
workflow test asks whether nuvs produces the right results; HTTP only adds a wire
format to break.

**Runtime tests** get `startJobsApiTestServer(state)`, a real `node:http` server
on port 0, because retry, backoff, ping-driven cancellation, credential handling
and status-to-error mapping only mean something over a real wire. A fetch mock
would assert them into existence rather than test them.

Both run `handleJobsApiRequest` over the same `JobsApiState`. That is not a
convenience — it is what keeps the two from drifting, and the half a test is not
using is the half that would quietly stop matching the real service. It is also
what lets a test be moved from one to the other without rewriting its setup, the
property that made the Python fixture usable at all.

The faked client is not a shortcut around the contract either. Every response
goes through `JSON.stringify` and back and is parsed with the same schema the
real client parses the real service's response with, and every non-2xx status
goes through the same `assertOkResponse`. A fixture answering with a shape the
contract does not describe fails there exactly as it would over a wire.

### The state is the assertion surface

`JobsApiState` mirrors Python's `WorkflowData` and exposes what its fixture
exposed, plus what this side needs:

| Field | What it records |
| --- | --- |
| `job` | The one job served. Flip `state` to drive cancellation. |
| `key` | The runner key the claim hands out and every call authenticates with. |
| `acquired` | Whether the job is claimed. A second claim, or one naming another workflow, is a 404. |
| `stepStartUpdates` | Step ids started, in order. |
| `finishCalled` | Whether `POST /jobs/{id}/finish` succeeded. |
| `finalizeCalls` | Every finalize call with the manifest it carried. |
| `cacheRegistrations` | Every `POST /caches` body, losers of a race included. |
| `caches` | Cache rows, by logical key. |
| `samples`, `subtractions`, `indexes`, `analyses`, `references` | Rows the metadata reads serve. |
| `settings` | The settings singleton. |
| `now` | The clock the routes stamp with. Injected, never patched. |

### camelCase, and why it is not a spelling nit

The fixture's responses are built from the schemas in `@virtool/contracts`
rather than hand-spelled, and every field crossing this wire is camelCase —
`startedAt`, `pingedAt`, never Python's `started_at` / `pinged_at`.

The embedded server is the fixture the jobs API client is tested *against*. If
server and client were both written snake_case they would agree with each other,
every test would pass, and the mismatch would surface only against the real
`apps/jobs-api` — the worst place to find it.

### Cancellation is a 401, not a flag

`JobPing` carries `pingedAt` and nothing else. Reaching a terminal state is what
stops a job key authenticating, so a cancelled job's next ping is answered
**401 with the state named in the body** (`Job is cancelled.`) rather than 200
with a flag set. A flag would have to be readable by a credential the same
transition revokes, and it would speak only for `cancelled` — a job swept up by
the ping timeout is `failed`, and the runner has to stop for that too.

That check sits *after* the key comparison, which is what makes naming the state
safe. Every other 401 is opaque (`Invalid credentials`), so a pod stopping on the
wrong one is visible in the logs rather than invisible.

```ts
state.job.state = "cancelled";

await expect(client.ping()).rejects.toThrow(UnauthorizedError);
await expect(client.ping()).rejects.toThrow("Job is cancelled.");
```

**The refusal covers every route but the claim**, not the ping alone. The real
service refuses in `requireJobRequest`, which is the floor under every handler;
the ping is only where a run *notices*. So a terminal job's key stops serving
metadata reads, step starts and finalize calls too, and the three messages are
the service's own wording — `Job is cancelled.`, `Job has failed.`,
`Job has succeeded.` A fixture that checked terminal state on the ping alone
would let a workflow keep working against a job production had already shut off,
and finishing a job would leave its own key working.

One consequence worth naming: `POST /jobs/{id}/finish` revokes the key that made
it, so a second finish is a 401 rather than the 409 the handler would answer. The
409 is still there, unreachable through a credential, because production keeps it
for the race between the guard's read and the transaction's lock.

### The claim is filtered by workflow

`POST /jobs/claim` reads its `workflow` query parameter, the way Python's
`ClaimJobView` and `handleClaimJob` do. Asking for a workflow this fixture's job
does not run is answered **404**, the same "no job available" a second claim
gets; a workflow that is not claimable at all — `build_index`, which parses as a
job workflow but which nothing creates any more — is **422**. Without the filter
a test could claim `nuvs` off a `create_subtraction` fixture and pass with a
configuration that leaves a real pod polling until its timeout.

### Duplicate step starts and finalized files

Two more places the fixture matches the service rather than being permissive:

- Starting a step twice is **409**. Progress is derived from how many steps have
  started, so a silent restamp would move a job's progress without moving its
  work.
- Finalizing a sample or a subtraction **records the manifest's files on the
  row**, so the next metadata read serves the keys the workflow just declared.
  The read path has to be reachable from the write path — that round trip is
  what a create-sample or create-subtraction test asserts. Sizes come back as
  `0`: the real route reads each one from storage, and the manifest declares
  none.

### Basic auth, arbitrary statuses, and hung responses

The embedded server enforces `job-{id}:{key}` over HTTP Basic on every route but
`POST /jobs/claim`, which is unauthenticated because the key comes back *from*
it. A route carrying a job id also checks it against the authenticated one and
answers 403 on a mismatch — the guard refuses a credential, the handler refuses a
path.

Three levers exist for the failure paths, each queued so several calls set up
several requests in order:

- `respondNextWith(status, body?)` — answer with any status instead of routing.
- `hangNextRequest()` — hold the response open forever. The socket stays up, so
  this is a stalled response rather than a connection failure.
- `destroyNextRequest()` — destroy the socket mid-connection, producing a genuine
  transport failure. That is the **only** thing the client retries; a status is a
  decision the jobs API made, and repeating it five times over 25 s would be a
  bug.

## Seeded builders

`createFakeJob`, `createFakeJobClaimed`, `createFakeSample`,
`createFakeNewSample`, `createFakeSubtraction`, `createFakeNewSubtraction`,
`createFakeIndex`, `createFakeReference`, `createFakeAnalysis`,
`createFakeSettings`, `createFakeQuality` and `createFakeUser` each take
`(overrides, seed)` and are typed against the `Workflow*` shapes in
`@virtool/contracts` — what the jobs API actually serves a workflow, not the
wider shapes the SPA reads.

Two calls with the same seed produce identical values, replacing Python's
`ModelFactory.seed_random(12/55/22/5)`. Determinism is not decoration: checksums
are the assertion, and a fixture that changed between runs would make one
unusable. Nothing global is seeded — a generator is derived per call, so two
builders cannot influence each other through a shared stream and a file's
fixtures do not change when a test is added ahead of them.

`STATIC_TIME` pins `2015-10-06T20:00:00Z`, the instant Python pins, and is
**injected** rather than monkeypatched onto a global clock. It is an ISO string
with a `staticTime()` accessor rather than a shared `Date`, because a shared
`Date` is module-level mutable state and one test mutating it would silently move
every other test's fixtures.

The relationships `data.py` set up by hand are carried over: a sample with two
`reads_{1,2}.fq.gz` files, a subtraction whose `files` list covers the source
genome and all six Bowtie2 shards, an unfinished subtraction with `ready: false`
and no counts, and an analysis wired to the sample, index, reference and
subtraction.

`createFakeNewSample` is the one that needs reading before it is used. It is a
sample `create_sample` has not finished, so it carries **uploads and no reads**,
and three of its details are load-bearing:

- The uploads are named `sample_R{1,2}.fastq.gz`, deliberately *not*
  `reads_{1,2}.fq.gz`. An upload keeps whatever the user called it and the
  workflow is what renames it, so a fixture whose uploads already carried the
  target names would pass against a port that renamed nothing.
- Their order is `sample_uploads.index`, which is the only thing linking an
  upload to the reads file it becomes.
- **`paired` is `false` even with two uploads**, because `getSample` derives it
  from the reads rows and those do not exist yet. That is what the jobs API
  really serves a running job, and a workflow must branch on `uploads.length`.

## Contexts stay serializable

`buildTestContext(workflow, overrides)` runs a workflow's own `buildContext`
through `createWorkflowContext`, so `assertSerializableData` runs on every test
context.

```ts
const { data } = await buildTestContext(workflow);

expect(JSON.parse(JSON.stringify(data))).toEqual(data);
```

That seam is what the deferred end-to-end bed depends on — a run there is files
plus a JSON blob — and it rots silently the first time someone parks a closure or
an open handle on `data`. A test asserting only on the values would not notice.

`createFakeContext(data, state, overrides)` skips `buildContext` for a step test
that wants to supply both halves directly. Its default client is
`createUnreachableJobsApiClient`, which rejects every call: a test that did not
set out to exercise the lifecycle should fail loudly rather than silently reach
the network.

## The fake subprocess runner

`createFakeSubprocessRunner(defaultResponse?)` implements `RunSubprocess` and
reproduces the real runner's outcome table exactly, because the three outcomes a
naive fake collapses into one are the three a workflow step branches on:

| Registration | Outcome |
| --- | --- |
| `{ spawnError: "ENOENT" }` | throws `SubprocessSpawnError` |
| `{ exitCode: 1, stderr: [...] }` | throws `SubprocessFailedError` with the tail |
| `{ cancelled: true }` | resolves `{ exitCode: null, signal: "SIGTERM", cancelled: true }` |
| `{}` | resolves `{ exitCode: 0, cancelled: false }` |

Cancellation is `exitCode === null && signal === "SIGTERM"`, **not**
`exitCode === 15`. Python treats 15 as a success on the reasoning that the run
was already failing for another reason, and that reasoning does not survive a
tool choosing 15 as an ordinary error code.

The stderr tail matters: the real runner drains stderr *and* the process promise
before deciding, because a subprocess can exit before its stdio is drained and
the tail is what says why it failed. Only the last twenty lines are kept, the
same cap the real runner applies.

`register(match, response)` takes an executable name, an argv prefix, or a
predicate; the **last** matching registration wins, so a test can override a
default set up in a shared helper. `calls()`, `commands()` and `wasRun(prefix)`
are the assertion helpers.

### `cd-hit-est -h` exits 1 while succeeding

Several steps probe a tool's version, and `cd-hit-est -h` prints its banner and
exits 1.

**`RunSubprocessOptions` has no allowed-exit-codes escape**, and the runner
throws `SubprocessFailedError` on any non-zero exit. So the fake models that
probe as an ordinary non-zero exit and **the call site catches the error and
reads `stderrTail`**. The runner does not return success for it and must not be
taught to:

```ts
run.register(["cd-hit-est", "-h"], {
	exitCode: 1,
	stderr: ["CD-HIT version 4.8.1 (built on Jan 1 2024)"],
});

try {
	await run({ command: ["cd-hit-est", "-h"] });
} catch (err) {
	if (err instanceof SubprocessFailedError) {
		return err.stderrTail[0];
	}

	throw err;
}
```

If the runner ever grows an `okExitCodes` option this changes — and it changes
there, not here.

## Storage: keys are minted and handed back

Storage is faked at the **backend**, not at HTTP. `MemoryStorage` already
implements `StorageBackend` and workflows take the backend as an argument, so
there is nothing to intercept.

`createTestStorage()` returns the backend plus `seedUpload`, `seedSampleReads`,
`seedSubtractionFiles`, `seedIndexArtifact`, `seedHmmFiles` and `seedAtKey`.

**No helper composes a key from database identity**, because nothing on either
side of the real system does. A row records its complete key and every read path
reads that column, so the per-domain key builders this harness was first
sketched against no longer exist — `mintStorageKey`, `mintRootStorageKey` and the
two fixed HMM constants are all that is left.

A helper therefore writes its bytes under a freshly minted key and **returns that
key**, and the caller attaches it to the fake row the jobs API fixture will
serve — `reads[].storageKey`, `files[].storageKey`, `upload.storageKey`. The code
under test reads the key out of that metadata, which is its only route to the
object.

**This is a stronger guarantee than the one it replaces, not a weaker one.**
Seeding through shared builders only caught a divergence between two builders.
Minting means the key is unguessable by construction, so a fixture that tries to
compose one — or quietly falls back to a filename — finds nothing and fails.

`seedAtKey` exists for the other half of that: a migrated row keeps whatever
prefix its object was written under, so at least one fixture should sit under a
legacy-shaped key matching no current pattern. `seedHmmFiles` is the exception
in the other direction and keeps `HMM_PROFILES_KEY` / `HMM_ANNOTATIONS_KEY`,
which are still fixed.

The **builders'** placeholder keys are drawn from the seed rather than from
`mintStorageKey`, which is `randomUUID`-backed and would cost the determinism a
checksum assertion stands on. They keep the same uuid-shaped opaque leaf, so
nothing can compose one; a test that seeds real bytes overwrites them with the
key the seeding helper returns, and that one *is* minted.

## Work paths

`createTestWorkPath(subdirectories?)` returns `{ path, cleanup }` from an
`mkdtemp` under `os.tmpdir()` with a `virtool-workflow-` prefix, laying out any
of `{reads, uploads, subtractions, indexes, hmms, caches}` asked for.

**Never a fixed path.** `createWorkPath` unconditionally `rm -rf`s its target
before recreating it, and Vitest runs test files in parallel processes — so a
shared path means one test deleting another's tree mid-run, which surfaces as a
missing file in whichever test lost the race. `mkdtemp` guarantees uniqueness per
call, covering both parallel files and repeated calls within one.

Cleanup is the caller's, registered with `onTestFinished` rather than a global
`afterEach`, which would tie every test in a file to one path.

## Checksums hash decompressed content

`checksumFile(path)` returns a sha256 hex digest, and `checksumDirectory(path)`
returns a sorted map of relative path to digest so a whole output tree is one
assertion.

Both hash **decompressed** content: gzip is detected by the two-byte magic and
piped through `createGunzip()` first. gzip embeds an mtime and varies by
compressor and level, so `pigz` and `node:zlib` produce different bytes from
identical input — hashing the compressed bytes would fail every comparison
against a Python-produced fixture for reasons that have nothing to do with
correctness. A file and its gzipped form therefore have the same digest, as do
the same content gzipped at two different levels.

Detection consumes `isGzipped` from `@virtool/archive/compression` rather than
re-reading the magic number here; a second copy of that check is a second thing
to get wrong. `decompressFile` is deliberately not used — it writes a second
file, and this only needs a stream. Everything is streamed, because these files
run to many gigabytes and a fixture that read one into memory would be the only
part of the harness that could not be pointed at a real workflow output.

## The lower-level HTTP server

`startTestServer(handler)` is the handler-driven server underneath
`startJobsApiTestServer`. It records every request with its body already read,
and a handler can leave the response alone to hang it or call `response.destroy()`
for a genuine transport failure. Reach for it when the test is about a status or
a socket rather than about the jobs API's behaviour.

`UNREACHABLE_BASE_URL` points at port 1 — privileged and unbound, so a connect
attempt is refused immediately rather than hanging until a timeout.

## Wiring

The harness is a subpath export of `packages/workflow`:

```json
"exports": {
	".": "./src/index.ts",
	"./testing": "./src/testing/index.ts"
}
```

Its tests run under node through `packages/workflow`'s own `test` script, which
`pnpm -r test` picks up — the per-package model every `packages/*` follows. A
project inside `apps/web/vitest.config.js` would contradict the harness's own
rule that nothing in it reaches the SPA, so there is none.
