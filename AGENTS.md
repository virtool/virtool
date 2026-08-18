# Virtool

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` — never write to
`CLAUDE.md` directly.

This is a pnpm monorepo. Use `pnpm` for all install, run, and exec commands —
never `npm` or `bun`.

## Apps

### apps/web

`@virtool/web`

- The Virtool single-page application and the TanStack Start server that
  serves it. Every request the SPA makes is a server function under
  `src/server/`.
- See **Client** and **Server** below, and
  [apps/web/README.md](apps/web/README.md).

### apps/site

`@virtool/site`

- The product website at [virtool.ca](https://www.virtool.ca).
- Deployed to Cloudflare Workers.
- See [apps/site/README.md](apps/site/README.md).

### apps/jobs-api

`@virtool/jobs-api`

- The service workflow runners call to claim, run and finish jobs.
- Image: `ghcr.io/virtool/jobs-api`.
- See [apps/jobs-api/README.md](apps/jobs-api/README.md).

### apps/tasks

`@virtool/tasks`

- **One** long-lived process carrying both halves of the task system: the
  periodic spawner that inserts scheduled tasks, and the runner that claims
  and executes what it spawns.
- Image: `ghcr.io/virtool/tasks`. No ingress and no Service — its listener
  serves only the health probes and a token-gated `/metrics`.
- See [apps/tasks/README.md](apps/tasks/README.md) and
  [docs/tasks.md](docs/tasks.md).

### apps/create-sample

`@virtool/create-sample`

- Turns a user's uploaded FASTQ files into a sample.
- Two steps, and one external binary, `quality-core` — a Rust crate.
- Image: `ghcr.io/virtool/ts-create-sample`.
- See [apps/create-sample/README.md](apps/create-sample/README.md).

### apps/create-subtraction

`@virtool/create-subtraction`

- Turns an uploaded FASTA into a subtraction an analysis can eliminate reads
  against.
- Two steps, and one external tool, `seqkit`.

- Image: `ghcr.io/virtool/ts-create-subtraction`.
- See [apps/create-subtraction/README.md](apps/create-subtraction/README.md).
### apps/pathoscope

`@virtool/pathoscope`

- Quantifies known viruses in a sample, reassigning the reads that matched
  more than one isolate.
- Eight steps, four external tools, and `pathoscope-core`.
- Image: `ghcr.io/virtool/ts-pathoscope`.
- See [apps/pathoscope/README.md](apps/pathoscope/README.md).

### apps/nuvs

`@virtool/nuvs`

- Finds viruses the reference does **not** describe, by discarding every read
  that maps to a known OTU or to a subtraction, assembling what is left and
  searching the contigs for viral motifs.
- Ten steps and five external tools — `skewer`, `bowtie2`, SPAdes, `hmmpress`
  and `hmmscan`.
- Image: `ghcr.io/virtool/ts-nuvs`.
- See [apps/nuvs/README.md](apps/nuvs/README.md).

## Packages

`packages/` holds shared, framework-agnostic libraries published as workspace
packages, plus two Rust crates — `pathoscope-core` and `quality-core`. Neither
crate is a pnpm workspace member; each is a standalone cargo project a workflow
invokes as a subprocess, and each has its own CI job. Only `pathoscope-core`
needs `libclang-dev` to build. `quality-core` computes a sample's `Quality`
blob from one FASTQ file and replaced FastQC in `apps/create-sample`; see
[packages/quality-core/README.md](packages/quality-core/README.md) for where it
matches FastQC and where it deliberately does not.

**Apps bundle; packages stay source.**

- `@virtool/archive` — tar, gzip and zip, for anything in the monorepo that
  reads or writes an archive. Never duplicate what it exports. See
  [packages/archive/README.md](packages/archive/README.md).
- `@virtool/bio` — sequence utilities (complement, translation, ORF finding,
  FASTA/FASTQ) and the pure text parsers the ported workflows need. See
  [packages/bio/README.md](packages/bio/README.md).
- `@virtool/contracts` — the shapes both sides of a wire share, plus the
  server-only helpers each behind its own subpath.
- `@virtool/data` — the Drizzle schema mirror and every Postgres query, as
  `packages/data/src/<feature>/data.ts`. Server-side only.
- `@virtool/logger` — a thin wrapper over pino. See
  [packages/logger/README.md](packages/logger/README.md).
- `@virtool/sentry` — the shared Sentry wiring, including the pino destination
  stream server logs are forwarded on.
- `@virtool/service` — the process-lifecycle pieces every long-lived service
  shares. Today that is `createShutdownController` (`./shutdown`) alone:
  readiness flip, LIFO hooks, listener, pool, Sentry **flush**,
  `process.exitCode` and an `.unref()`'d backstop, with every dependency
  injected. Steps take an equal share of the budget unless a hook declares its
  own `timeoutMs`, which is reserved out of what the rest divide. It is **not**
  a home for the probe server or the metrics registries, however alike those
  look across the three services.
- `@virtool/sqlite` — the reference index SQLite artifact: the schema mirror,
  the reads a workflow makes against one, and the writer that produces one.
  Depended on by both `@virtool/data`, which writes the snapshot a finished
  build publishes, and the workflow executors, which read it — that second
  consumer is why it is not part of `@virtool/workflow`. `node:sqlite` and the
  filesystem are its whole dependency surface; it has no runtime dependencies
  at all.
- `@virtool/storage` — the five-method streaming object-storage interface and
  its S3 and Azure backends. Server-side only.
- `@virtool/workflow` — the workflow runtime and testing harness.

## Rules

- No app may import another app's source.
- Don't use the dev server. Use Tilt and Minikube via the root `Tiltfile`; see
  [dev/README.md](dev/README.md).

## Tooling

### Commands (from repo root)

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Typecheck | `pnpm typecheck` |
| Lint + format | `pnpm check` |
| Format only | `pnpm format` |
| Dead-code scan | `pnpm knip` |
| Build | `pnpm build` |
| Test (all packages) | `pnpm test` |
| Test (watch, web app) | `pnpm --filter @virtool/web test:watch` |
| Test (one file) | `TZ=UTC pnpm --filter @virtool/web exec vitest run <path>` |
| Rust crates | `cargo test` / `cargo fmt` (in `packages/pathoscope-core` and `packages/quality-core`) |

`TZ=UTC` matches the `test` script and every CI test job — drop it and that
command becomes the only unpinned way to run the suite.

`pathoscope-test`, `quality-test`, `build-pathoscope` and `build-nuvs` are the
only path-filtered jobs in `ci.yaml`, and they take **a filter each**, because
their inputs differ: the crate jobs run cargo and read no TypeScript, while
each image build bundles its own app and so depends on every workspace package
its Dockerfile copies. One shared filter would run the libclang-and-cargo job
on any `packages/workflow` change, and would rebuild each image for the other's
inputs — `pathoscope-image` carries `packages/pathoscope-core` and `nuvs-image`
does not. Extend the `changes` job's filters in the same
commit as anything that gives a job a new input — in
particular, **every path a workflow Dockerfile `COPY`s must appear under that
image's filter**, or the build is skipped on the pull request that breaks it
and fails on the push to `main`, where nothing gates it. That covers everything
the shared `base` stage copies, packages the app does not import among them:
`base` copies `packages/data`, `packages/service` and `packages/bio` whichever
target was requested, so both image filters list all three.

### When to run checks

- Route changes: run `pnpm --filter @virtool/web build` before type-checking.
  This regenerates the checked-in `apps/web/src/routeTree.gen.ts`; commit it if
  changed. Never use `tsr generate`: its outdated router CLI removes required
  Start type declarations.
- Test changes: run the affected file with
  `TZ=UTC pnpm --filter @virtool/web exec vitest run <path>`.
- Before committing: run `pnpm check`, `pnpm typecheck`, and `pnpm knip`.
- Run the full test suite only when asked or for cross-cutting changes.
- All checks must pass. Treat failures as caused by your changes because `main`
  is green; never modify the working tree to compare against `main`.
- Keep no dead code. Wire up or delete unused exports; tag intentionally public,
  uncalled exports with `@public`; remove `export` from file-local symbols.

## Client

Client code is server-rendered and compiled with React Compiler. Keep render
pure: do not read browser globals, clocks, randomness, locale, or mutable
module state during render. Use `useSyncExternalStore` with a cached server
snapshot for ambient browser state and `ClientOnly` for measured subtrees.

Use aliases across directories and `@server/*` for every client-to-server
import. When adding a feature alias, add it to the server
`noRestrictedImports` list. Keep server-only and native dependencies out of
the browser graph.

Follow the client conventions in [apps/web/README.md](apps/web/README.md), with
the detailed rationale in:

- [docs/ssr.md](docs/ssr.md) — SSR, hydration, time, and CSP
- [docs/queries.md](docs/queries.md) — React Query and error/loading states
- [docs/bundling.md](docs/bundling.md) — route splitting and server-only code

## Server

Web-specific server conventions live in
[apps/web/README.md](apps/web/README.md#server-development). Keep these
repository-wide rules in view:

- Server features flow `functions.ts` → optional `service.ts` → `data.ts`.
  Framework-free persistence code belongs in `@virtool/data`; app composition
  and transport boundaries stay in the app.
- Shared wire shapes belong in `@virtool/contracts` and are imported directly.
  Shape and narrow values at the publishing boundary. Timestamps cross wires as
  `Date`; raw JSON schemas use `z.coerce.date()`.
- Virtool-owned environment variables use the `VT_` prefix, and every configured
  key supports a file-backed variant. Follow [the shared environment
  configuration pattern](docs/env.md).
- Server code logs through `@virtool/logger`, with structured fields first and
  a stable message second. Data functions receive a `Logger`; apps own logger
  construction and optional Sentry forwarding. See
  [packages/logger/README.md](packages/logger/README.md).
- Each long-lived service owns its Prometheus registry and token-gated
  `/metrics` endpoint. Keep labels bounded and use the shared constant-time
  bearer-token helper. See [the web metrics guide](apps/web/README.md#metrics),
  [the jobs API guide](apps/jobs-api/README.md#metrics), and [the tasks
  guide](docs/tasks.md).
- `apps/tasks` runs both the periodic spawner and task runner. Its lease,
  fencing, shutdown, progress, metrics, and task-body contracts are maintained
  in [docs/tasks.md](docs/tasks.md); do not duplicate them here.

## Data

### Data store: Postgres-first

The TypeScript server reads and writes **Postgres only** (via
Drizzle), through `@virtool/data`: the schema mirror is
`packages/data/src/db/schema/`, the pool comes from `createDb`
(`@virtool/data/db/pg`), and every query lives in a
`packages/data/src/<feature>/data.ts`. Python is the sole owner of schema
and migrations — TS code reads and writes against the schema Python
defines. Mirror Python-side column defaults with Drizzle `.$defaultFn()`,
never `.default()` — the real columns have no `server_default`, so
`.default()` inserts `null`.

**Mirror a column's constraint, and only its constraint.** A `text`
column Python closes with a CHECK constraint is typed
`text("state").$type<JobState>()`, with the constraint named in a comment
— `$type` asserts rather than validates, which is exactly right when the
database is doing the enforcing. A column with **no** constraint stays
`string` no matter how enumerable its values look: `jobs.workflow` is one,
Python's `Workflow` being an application-level enum, and that openness is
what `apps/jobs-api/src/metrics/registry.ts`'s `other` folding and
`isJobStateTerminal`'s `string` parameter exist for. Never narrow a column
the database leaves open, and never widen one it closes. The union itself
lives in `@virtool/contracts` — one definition, imported by the mirror.

**Declare a foreign key table-level, with an explicit name.** Use
`foreignKey({ columns, foreignColumns, name })`, never an inline
`.references()`, and name it `{table}_{column}_fkey` — the name Postgres
assigned, because Alembic never named these itself. `.references()`
auto-names a constraint production does not have, and because migration
`0000` is stamped rather than run, the wrong name is caught by nothing
until a much later migration emits SQL against a constraint that does not
exist. `schema/foreignKeys.test.ts` pins all 54.

Three `pgEnum` declarations (`messagecolor`, `indextype`,
`session_type_enum`) describe a Postgres enum where the real column is
`text` plus a CHECK. Each carries a comment saying so. They are inert —
nothing generates migrations from this side — so leave them alone rather
than restructuring. `subtraction_files.type` is the opposite case and is
genuinely backed by the `subtractiontype` enum.

Postgres is now Virtool's sole data store — Python removed MongoDB
entirely, so every domain's records live in Postgres and there is no
Mongoose / Mongo-driver layer here. A domain not yet reachable from the
TS server is missing only its Drizzle mirror and server functions, not
its data — build those against the tables Python already defines.

**Serve a legacy-shaped table on its own shape; do not renormalize it.**
The OTU domain writes `legacy_otus.data` as verbatim Mongo — isolates
embedded, `_id` keys — because history diffs address that document
positionally and Python still writes the same tables. Reshaping it from
this side misapplies every diff already recorded and corrupts the
analyses read path. Renormalizing is a Python-side migration.

**An index build is two writes with a task between them, and this side
runs both.** `createIndex` (`@virtool/data/indexes/data`) inserts the
pending `indexes` row, stamps every unbuilt `legacy_history` row with it,
and creates a `create_index` task; `generateTaskIndex`, in the same
module, is what the runner that claims it executes — patching the
manifest's OTUs, writing **both** artifacts to minted keys, recording an
`index_files` row for each, stamping `last_indexed_version` and flipping
`ready`.

**A build publishes `reference-snapshot.v1.sqlite` and
`reference-v2.json.gz`, or it publishes neither.** The snapshot is the
only one an analysis can read — a real reference is past the maximum
string length `JSON.parse` can return — so a build that registers the
gzipped JSON alone is `ready` and unusable, and every workflow claimed
against it dies in `buildContext`. Both rows are written in the
transaction that flips `ready`. The manifest is walked once per artifact
rather than held for both: the whole point of the chunked patch loop is
that no reference is ever in the heap. Python's `CreateIndexTask`
does the same work and both runners are live until the cutover, so the
two must stay interchangeable. The
insert runs under
`pg_try_advisory_xact_lock(hashtext('index_build:{referenceId}'))`, the
same key Python takes, so a build started from either service excludes
one started from the other. Don't drop the lock. `indexes.storage_key`
is dead — it is still `NOT NULL`, so the insert fills it, but nothing
composes a key from it any more.

See [docs/database.md](docs/database.md) for which domains the TS
server can reach today, why the OTU tables keep their legacy shape and
what that costs a writer, the `legacy_id` resolution rules, and the
column-default convention.

### Files live in object storage, shared with Python

Uploads, reads, analysis results, indexes, subtractions, HMM profiles,
and caches live in S3 or Azure Blob — **the same bucket Python uses**.
`@virtool/storage` exposes a five-method streaming interface
(`read`, `write`, `delete`, `list`, `size`); there are no paths, file
handles, or presigned URLs. There is no filesystem backend.

**A key is recorded, not derived.** Every row naming a stored object
carries its complete key in a `storage_key` column, and every read path
reads that column — nothing recomposes a key from a row id, a legacy id,
or a filename. New keys come from `mintStorageKey(domain, parentId)` and
`mintRootStorageKey(domain)` in `@virtool/storage/keys`, whose UUID leaf
must stay hyphenless to match Python's `uuid4().hex`. The `parentId`
segment is for human inspection only; keys in the bucket are
heterogeneous by design, because a migrated row keeps whatever prefix it
was written under.

**A key arriving over the wire is validated, not recomposed.** A workflow
finalizing its outputs sends the key it wrote to, and the jobs API records
it verbatim after checking it sits under `{domain}/{parentId}/` for the
resource in its own path — plus non-empty, no leading `/`, no empty
segment, no `..` segment. Composing a second key server-side would put a
second opinion about where the bytes went next to the writer's. `POST
/caches` is the exception and takes a bare uuid, because a cache key
really is derivable.

`StorageError` and `StorageKeyNotFoundError` come from
`@virtool/storage/errors` and extend plain `Error`, not the data layer's
`AppError`, so the storage package carries no dependency on the data layer.

The backend is built once at startup and **passed into `data.ts`
functions as an argument, the way `db` is**. `deleteKeys` never throws;
it returns failures, and callers must log them.

**Cleanup enumerates recorded keys; there is no prefix sweep.** Read a
row's key *before* deleting the row, and where a cascade takes child rows
with it — a sample's analyses take their `analysis_files`, an index takes
its `index_files` — collect the children's keys in the parent's delete.
An object written before keys were recorded is named by no row, survives
the delete, and is left for an orphan sweep that does not exist yet.

Client code must never reference the whole `import.meta.env` object.
Vite would serialize every `VT_`-prefixed variable — including
`VT_STORAGE_S3_SECRET_ACCESS_KEY` — into the browser bundle. Read named
keys instead; `src/app/__tests__/clientEnv.test.ts` enforces this.

Unit-test anything that stores files against `MemoryStorage`. The
backends themselves are tested against real Garage and Azurite
containers in `@virtool/storage`'s `integration` Vitest project.

See [docs/storage.md](docs/storage.md) for the interface, the key
layout, the backend configuration and its both-or-neither credential
rule, the three S3 quirks, and the testing setup.

### Every outbound request identifies itself with a `User-Agent`

Anything reaching a third party — NCBI BLAST and GenBank, the virtool.ca
HMM manifest, the GitHub-hosted release archive — sends
`User-Agent: virtool`, from the one `USER_AGENT` constant in
`@virtool/data/userAgent`. NCBI throttles or blocks anonymous traffic and
BLAST polling is the highest-volume outbound path here; GitHub refuses a
request carrying no `User-Agent` at all.

**There is no shared HTTP client to hang it off, and adding one is out of
scope by decision.** Python built a single `aiohttp.ClientSession` at
startup; here each call site takes its own `AbortSignal.timeout`, which
works, and a singleton client would be exactly the module-scope
construction `packages/data` avoids everywhere else.

**The token carries no version**, deliberately: `packages/data` has no
build-time global to read one from — `apps/web` has `__APP_VERSION__` and
`apps/tasks` a JSON import of its own manifest, neither visible from
there — and one token every call site agrees on beats a version on the
subset that could reach one.

### Server → client push runs over SSE with id-only frames

Server-pushed cache invalidations are delivered over a single SSE
stream at `/events`. Each frame carries `{ domain, operation, id }`;
the client invalidates React Query caches by `domain` and refetches
through the REST API so per-user auth is
enforced on the refetch instead of in a fanout broadcast. Both
Python and Node publish onto the Postgres `client_events` channel;
`routes/events.ts` is the sole consumer.

`jobs` and `tasks` update frames are the exceptions: a running job or
task emits one per progress step and every one on screen holds its own
`detail(id)` query, so invalidating per frame cost a request per record.
They route through `createJobRefreshQueue` (`jobs/refresh.ts`) and
`createTaskRefreshQueue` (`tasks/refresh.ts`), which buffer ids and read
them with the batched `getJobs`/`getTasks` server functions instead.
Don't add a `detail(id)` invalidation back for either.

Adding a domain is a change in **three** places — `SseDomainSchema` and
`SseMessageSchema` (`packages/contracts/src/sse.ts`), and
`reactQueryHandler`'s `domains` record — and doing only the first two
leaves every frame parsed and then dropped. Python needs no change:
it publishes free-form domain strings, and a domain the schema does not
name is discarded silently at the client, which is how `subtractions`
frames went unhandled for as long as they did.

See [docs/server-push.md](docs/server-push.md) for the wire format,
auth on the SSE side, the batching queues, and the follow-up TODOs.

## Workflows

### The runtime is `@virtool/workflow`: no injection, no teardown, no hooks

Every workflow executor runs on `@virtool/workflow`: `defineWorkflow`,
`runWorkflow`, `createWorkPath`, `createRunSubprocess`,
`parseWorkflowRunConfig`, and `runWorkflowApp`. It is the port of Python's
`virtool/workflow/`, and it knows nothing about a database.

**The run loop and the job lifecycle are strictly apart.** `runWorkflow`
**returns** an outcome and never touches the network, `process.exit`, or a
signal handler; `runWorkflowApp` — the entrypoint a workflow app's `main.ts`
calls — owns all of that.

Object storage is reached the way `db` is on the server side: a
`StorageBackend` is **passed in as an argument**, never constructed here and
never a module-level singleton. `runWorkflowApp` builds it once from
`config.storage` and puts it on the run context as `storage`, so a step reaches
the bucket without constructing anything and a test hands the whole runtime a
`MemoryStorage`. A pod with no bucket cannot download the reads it was claimed
to analyse. See the workflow app READMEs for environment configuration and the
file layer below for transfer rules.

**The cache is the workflow's, not the jobs API's.** `createWorkflowCache`
(`cache/cache.ts`) resolves a logical key through `GET /caches/{key}` and then
moves the bytes itself; `POST /caches` registers a row **after** the blob
lands, because a row published ahead of its blob makes the next reader fail
where it should have missed. The blob is an **uncompressed tar of one
directory** whose single top-level entry is that directory's basename — Python's
`write_path_as_tar` layout exactly, which is what lets the two implementations
share the `reference_mapping_index` and `subtraction_mapping_index` namespaces.
An already-registered key is **success**, not an error.

Three decisions shape it and are not up for re-litigation:

- **No dependency injection.** Python resolves fixtures by introspecting a
  step's parameter names against a `ContextVar` registry. Here a run's
  context is an ordinary object built once, before the first step, by a
  per-workflow `buildContext`. Its `data` half must survive a JSON round
  trip — no class instances, no closures, no live handles — because the
  deferred end-to-end test bed expresses a run as files plus a JSON blob.
  `createWorkflowContext` asserts that on every run, not only under test.
  `state` is the mutable cross-step scratch and carries no such constraint.
  Lazy or memoized accessors were rejected; per-workflow construction is
  how one workflow fetches HMMs and another does not. **What is eager is
  resolution, not necessarily transfer**: every metadata read happens here
  and `data` records each input's storage key beside its work path, but a
  file only one branch reads is downloaded by the step that takes that
  branch, with `buildContext` checking the key with `storage.size` to keep
  failing fast.
- **No teardown.** The container is ephemeral and process exit reclaims
  everything. Do not port `AsyncExitStack` or add a `dispose` /
  `Symbol.asyncDispose` layer.
- **No lifecycle hooks.** Python's ten hooks carried three callbacks in all
  of production: four `on_failure` deletions, plus `on_step_start` and
  `on_success` used internally by its own runtime. The deletions are gone by
  decision — a failed run leaves its half-built resource for the user to
  delete — `on_success` is redundant against the returned `RunOutcome`, and
  `on_step_start` survives as a single optional `onStepStart` on
  `RunWorkflowOptions`. Don't reintroduce a registry to give a workflow
  somewhere to put teardown; that is the previous rule again.

Steps are an **explicit ordered array**, never a scanned module. A step's
`id` is authored in `snake_case` and **must match the Python function name
it was ported from** — the jobs API stores it, so a slugified display
name changes the shape of a job's step list at cutover.

Cancellation is **cooperative** and is the one real divergence from Python:
aborting an `AbortSignal` interrupts nothing, so `runWorkflow` races the
in-flight step against the signal and abandons it rather than waiting,
leaving a `catch` attached so its later rejection cannot take the process
down mid-report.

Every bioinformatics tool runs through `context.runSubprocess`, which
`runWorkflowApp` builds once per run with
`createRunSubprocess({ signal, logger })`. Four rules it carries,
each of which is a departure from Python or from execa's defaults:

- **stdout is opened on `/dev/null` unless a `stdout` handler is given.** An
  unread pipe is a buffer that fills, and a tool writing a SAM stream fills
  it fast. stderr is always piped, logged line by line, and its last twenty
  lines ride on `SubprocessFailedError`.
- **Lines are split with a byte ceiling**, 128 MiB by default — the same
  `limit` Python passes to `asyncio.create_subprocess_exec`. `node:readline`
  has no ceiling at all. Overrunning it throws `SubprocessLineLimitError`
  and kills the tree.
- **Descendants are killed, and execa cannot do it.** There is no
  `killDescendants` option; `kill()` and `cancelSignal` reach the direct
  child only, which for `bowtie2` is a perl wrapper. So the runner spawns
  `detached: true` and signals `-pid` — SIGTERM, then SIGKILL after 5s.
  `ESRCH` and `EPIPE` from a kill racing an exit are logged at `debug` and
  never surfaced.
- **Exit code 15 is a failure here and a success in Python.** Only a
  cancellation-driven kill resolves, as `cancelled: true`.

The lifecycle half — `createJobsApiClient`, `claimJob`, `startPingLoop`,
`runWorkflowApp` — carries five rules:

- **Paths are unprefixed and every wire field is camelCase.** The jobs API
  serves no SPA, so `/jobs/claim` and `/jobs/{id}/ping` match Python's byte
  for byte. `baseUrl` is the cluster-internal jobs API service, **never**
  the public web origin. Shapes come from `@virtool/contracts`; don't
  redeclare one.
- **A pod learns its job id from the claim and nowhere else.** `claimJob`
  polls unauthenticated — the key comes back *from* the claim — and returns
  `null` when its signal aborts, which is how a claim timeout and a SIGTERM
  both arrive.
- **Retries are five, at a flat 5 s, on transport failures only.** Not
  exponential — that is Python's observed behaviour and the ping-timeout
  sweep is calibrated against it. Never retry a status the jobs API chose.
- **The ping loop is the cancellation channel, and a 401 is the signal.** A
  job key stops authenticating the moment its job reaches a terminal state,
  so a refused ping means the job is over — cancelled, or failed by the
  sweep — and the loop calls `signals.cancel()`. There is deliberately **no
  `cancelled` flag** on `JobPing`, which carries only `pingedAt`: a flag
  would have to be readable by a credential the same transition revokes,
  and it would speak only for `cancelled`. The jobs API names the state in
  the 401 body and the loop *logs* that message without branching on it —
  a broken credential produces the same 401, and `Invalid credentials`
  rather than `Job is cancelled.` in the logs is how that bug is caught.
- **The ping loop owns its retry policy** (pings are issued with retries
  disabled). A 401 is neither retried nor counted; every other failure is,
  and it gives up after five *consecutive* failures — resetting on success,
  which Python does not — logging at `warn`, and lets the run continue. Its
  ~20 s give-up window must stay well inside the jobs API's **five-minute**
  stalled-job sweep.
- **A failed workflow exits 0.** Failure is an API-side transition and a
  non-zero exit makes the `ScaledJob` retry the pod. Only a broken pod exits
  1; only SIGTERM exits 124. There is deliberately no failure call to make —
  the wire contract has no "fail" endpoint.

See [docs/workflow-runtime.md](docs/workflow-runtime.md) for the step
model, the eager-context rationale, the hook survey behind dropping them,
the terminal-state table, the cancellation race, the subprocess runner's
outcome table and process-group kill, and the full config table.

### Workflow files stream, and a key is minted, never composed

Every byte a workflow moves goes through `downloadToPath` / `uploadFromPath`
(`files/transfer.ts`). Files run to many gigabytes, so **nothing may
buffer** — `readFile`, `writeFile` and `Buffer.concat` are absent from the
transfer path by rule, not by accident.

**No key is derived from row identity, on either side.** A key to read
arrives from the jobs API, off the row that records it. A key to write is
minted with `mintStorageKey(domain, parentId)` and sent back on the finalize
manifest, which the route validates against that resource's own
`{domain}/{parentId}/` prefix and then records verbatim. A cache is the one
exception in the other direction: `POST /caches` takes a bare uuid and
composes `cacheKey(uuid)` server-side, because that key genuinely is
derivable. The only fixed builders left are the two HMM constants.

**Finalize is one call per resource** — `PATCH /subtractions/{id}`,
`PATCH /samples/{id}`, `PATCH /analyses/{id}` — carrying the resource's own
fields plus the manifest, so a run cannot end with the parent flipped
`ready` and its file rows missing. The manifest declares no `size` and no
`name_on_disk`: the row is written with the byte count the route reads back
from storage, which is what makes a row pointing at nothing impossible.

**A resource that is unusable without its files must carry them**, and the
bound is on the contract in `@virtool/contracts` so the runtime cannot build
the call: a sample sends one or two reads (`.min(1).max(2)`), a subtraction
sends its source FASTA (`.min(1)`). An analysis manifest is legitimately
empty — pathoscope's whole output is the `results` blob — and `results`
being required is the guard there. A **subtraction accepts one filename,
`subtraction.fa.gz`**, not Python's seven: nothing consumes the bowtie2
shards, because both analysis workflows build the index locally from the
`.fa.gz`. That is the **write** path only — subtractions Python finalized
still have `bowtie2` rows, `GET /subtractions/{id}` keeps serving them, and
`SubtractionFileType` keeps both members. See
[docs/jobs-api.md](docs/jobs-api.md).

Tar and gzip are **`@virtool/archive`**, not this package, and nothing here
re-exports them.

`deriveCacheKey` (`cache/key.ts`) reproduces `json.dumps(..., sort_keys=True,
separators=(",", ":"), ensure_ascii=True)`, which `JSON.stringify` does not.
Mark a Python `float` with `float()` — an unmarked number serialises as an
`int`, and `1.0` versus `1` is a different key. Non-ASCII param keys and
numbers the two languages format differently are rejected rather than
guessed at. `cache/key.test.ts` holds a golden table generated by running
Python; **never update a golden to match this implementation's output** —
that converts a caught divergence into a permanent one.

### The reference index is a SQLite file, read with `node:sqlite` and no ORM

An index reaches a workflow as one file, `reference-snapshot.v1.sqlite`,
written by a finished build. `@virtool/sqlite` mirrors that schema
(`schema.ts`), reads it (`queries.ts`) and writes one (`create.ts`) — the
snapshot itself, and the collapsed artifact pathoscope produces, which is named
`index.v1.sqlite` because a partial reference must not be mistakable for a whole
one. Both carry `format = virtool-reference-sqlite` in their `metadata` table.
JSON was abandoned because a real reference exceeds V8's maximum string
length.

It is a package rather than part of `@virtool/workflow` because both sides
need it: making `@virtool/data` depend on the workflow runtime would drag
execa, undici and tar-stream into `apps/tasks` and the jobs API, and a
second copy of the DDL would be two opinions about a binary format two
languages have to agree on.

**There is no Drizzle here**, against the original plan: it ships no
`node:sqlite` driver, and the three alternatives all fail — `sqlite-proxy`
materialises every row, `better-sqlite3` is a native dependency, and using
Drizzle for SQL generation alone adds a fake driver for six fixed queries.
`node:sqlite` is unflagged on Node 22 and 24, so nothing needs raising.

Four rules it carries:

- **Ordering is the output.** Sequence order decides FASTA order, so Bowtie2
  index order, so every SAM line. `iterSequences`, `iterDefaultSequences` and
  `iterOtuSequences` carry Python's `ORDER BY` verbatim.
- **`iterOtus` returns insertion order, and the `ORDER BY` clauses inside its
  subqueries are no-ops that must stay.** SQLite sorts the one row an
  aggregate returns, not the rows entering it, so `json_group_array` collects
  in scan order. Python has the same no-op; `cd-hit-est` picks its
  representative by the order it sees, so "fixing" the sort changes the
  analysis. Removing the clauses could change the plan, and the plan is what
  decides the order.
- **Nothing materialises the index.** Every iterating query is an async
  generator over `StatementSync.iterate()` that yields to the event loop each
  batch, so the ping loop survives a long scan. Id sets bind through
  `json_each`, never one `?` per id.
- **The fixture is Python's.** `packages/sqlite/src/fixtures/` holds an
  artifact Python built plus the golden results of every query; `generate.py`
  is the provenance record. **Never edit a golden to match this
  implementation's output.**

See [docs/indexes.md](docs/indexes.md).

### Workflow tests stand on `@virtool/workflow/testing`

The harness replaces Python's `virtool/workflow/pytest_plugin/` and
`tests/fixtures/workflow_api/`. It lives in
`packages/workflow/src/testing/` and every workflow app's tests import it
from `@virtool/workflow/testing` — never from `apps/web`, which it does
not reach.

**Everything is a factory function.** pytest injected fixtures by
parameter name and resolved a dependency graph between them; Vitest has
no equivalent and this harness deliberately builds none. Nothing is
installed by importing it, there is no module-level mutable state — test
files run in parallel processes — and anything needing cleanup returns
its disposer for the caller to hand to `onTestFinished`.

Six rules it carries:

- **It splits by what the test is asking.** A *workflow* test gets
  `createFakeJobsApiClient(state)` and exercises no HTTP — "does nuvs
  produce the right results" gains nothing from a wire format. A
  *runtime* test gets `startJobsApiTestServer(state)`, a real
  `node:http` server, because retry, ping-driven cancellation, Basic
  credentials and status-to-error mapping only mean something over one.
  **Both run `handleJobsApiRequest` over the same `JobsApiState`**, so a
  test moves between them without rewriting its setup and the two halves
  cannot drift.
- **The fixture's responses are camelCase and built from
  `@virtool/contracts`.** The embedded server is what the jobs API
  client is tested *against*: spelled snake_case on both sides they
  agree with each other and the mismatch surfaces only against the real
  `apps/jobs-api`. Cancellation is therefore a **401 naming the state**,
  not a `cancelled` flag — `JobPing` has none.
- **Builders are seeded, with a fixed default.** `createFakeJob`,
  `createFakeSample`, `createFakeSubtraction` and the rest take
  `(overrides, seed)` and are reproducible, because checksums are the
  assertion. `STATIC_TIME` is **injected**, never patched onto a global
  clock, and is an ISO string rather than a shared `Date` — a shared one
  is module-level mutable state.
- **`buildTestContext` goes through `createWorkflowContext`**, so
  `assertSerializableData` runs on every test context. That seam is what
  the deferred end-to-end bed depends on and it rots silently the first
  time someone parks a closure on `data`.
- **Seeding helpers mint their keys and return them.** The caller
  attaches the returned key to the fake row the fixture will serve, and
  the code under test reads it back out of that metadata — its only
  route to the bytes. A minted key is unguessable by construction, so a
  fixture that composes one from a row id or falls back to a filename
  finds nothing. `seedHmmFiles` is the exception and keeps the two fixed
  HMM constants.
- **`createTestWorkPath` is never a fixed path.** `createWorkPath`
  unconditionally `rm -rf`s its target, so a shared path means one test
  deleting another's tree mid-run.

`checksumFile` and `checksumDirectory` hash **decompressed** content —
gzip embeds an mtime and varies by compressor, so hashing the compressed
bytes fails every comparison against a Python fixture for reasons that
are not correctness.

See [docs/workflow-testing.md](docs/workflow-testing.md).

## Code style

The basics:

- **Functions:** Use function declarations, not arrow functions. For React
  components this is enforced by Biome's
  `useReactFunctionComponentDefinition`. Everywhere else it stays a
  convention — Biome has no general `func-style` equivalent, so nothing
  catches a violation in a plain function but review.
- **Refs:** Don't use `forwardRef`. React 19 makes `ref` an ordinary prop:
  type a wrapper's props with `ComponentPropsWithRef` and let `ref` flow
  through the `...props` spread. `forwardRef` also trips
  `useReactFunctionComponentDefinition`, because the component ends up as a
  function expression rather than a declaration.
- **Imports:** Biome organises imports automatically.
- **Conditionals:** Always use curly braces with `if`/`else`.
- **Prefer `const`** over `let`.
- **Types:** Use `type`, not `interface`. Enforced by Biome's
  `useConsistentTypeDefinitions`. The exception is declaration merging —
  augmenting `Window` or TanStack Router's `Register` requires an
  `interface`; those sites carry a `biome-ignore` explaining why. Prefer
  string literal unions over `enum`.
- **JSDoc:** Every exported `type` gets a one-line `/** ... */`, leading
  with what the thing *is* rather than a sentence about its behavior — the
  label is the first thing a hover shows.
- **Naming:** `is`/`has`/`get` for pure reads; `check`/`validate`/
  `assert` for may-throw. The `is`/`has` line is loose — don't overthink
  it. A prepositional name (`lifetimeFor`) isn't part of the rule; prefer
  `getLifetime`. A `createServerFn` export gets an `Fn` suffix
  (`loginFn`, `getSampleFn`) — it's an RPC call, not a plain function,
  and the suffix marks that at every call site. The domain function it
  wraps keeps the plain name (`login`, `getSample`) and never crosses
  the network. `functions.ts` imports that data function under its own
  name — the `Fn` suffix already keeps the two apart, so don't alias it
  to `...Impl` on the way in.
- **Comments:** Default to none. Document *why* when non-obvious, not
  *what* — never restate the code, reference the current task, or name
  the caller (those rot the moment something moves). Never narrate
  history ("this used to do X, now it does Y") — that's git blame's job,
  and it just accretes stale layers; write a comment about a past change
  only if reverting it would silently reintroduce a bug, phrased as a
  standing warning, not a changelog. Syntax: `/** ... */` for the one-line
  JSDoc on an exported type (or a label on a function/constant that needs
  one); `/* ... */` for a multi-line *why*; `//` for one-liners only —
  never chain `//` lines into a block.
- **Concurrency:** Independent awaits go in `Promise.all` — don't pay
  the sum of latencies. Skip it when a later call needs an earlier
  result, the calls share one Postgres transaction (serialised
  server-side regardless), or an early failure should short-circuit
  expensive later work. Use `Promise.allSettled` when every result is
  needed regardless of failures.

## Testing

- **Framework:** Vitest; Vitest node env for packages.
- **Projects (web app):** `web` runs browser code under jsdom.
  `server` runs `src/server/**` under **node** — server code runs on
  Node in production, and under jsdom its typed arrays come from a
  different realm, so bytes compare unequal to identical bytes.
  `a11y` runs `*.a11y.test.tsx` under headless Chromium
  (Playwright) so axe's layout-dependent rules — `color-contrast` above
  all — can actually run; it needs `playwright install chromium`. `pnpm
  test` runs all three; use `--project <name>` to narrow.
- **Projects (`@virtool/storage`):** `unit` covers everything testable
  against `MemoryStorage`; `integration` runs the S3 and Azure backends
  against real Garage and Azurite containers and has its own CI job.
- **`@virtool/workflow` runs under node via its own `test` script**,
  which `pnpm -r test` picks up — the per-package model every
  `packages/*` follows. **Do not add a project for it to
  `apps/web/vitest.config.js`**: that file is where `web`, `server` and
  `a11y` live, and declaring a package's project inside `apps/web` would
  contradict the harness's own rule that nothing in it reaches the SPA.
  Its tests are server-shaped and need node for the same reason the
  `server` project does.
- **`@virtool/data`**, **`@virtool/jobs-api`** and **`@virtool/tasks`**
  each run one node project against a Postgres testcontainer, and each
  has its own CI job for the same reason storage does — a container pull
  does not belong in the fast package loop. All three are excluded from
  `Packages / Test`.
- **The Postgres container is described once**, in
  `packages/data/src/db/test/globalSetup.ts`. The `@virtool/data`
  project, the web app's `server` project, `@virtool/jobs-api` and
  `@virtool/tasks` all name that module as their `globalSetup` — the
  latter three through the `@virtool/data/db/test/globalSetup` subpath —
  so the options cannot drift and `withReuse()` boots one container for
  every suite locally. There is no teardown; `docker rm -f` it when done.
  Don't add a second copy of the container options.
- **Test location:** `__tests__/` directories alongside source files
  (web), or sibling `*.test.ts` files (packages).
- **Test files:** `ComponentName.test.tsx` or `functionName.test.ts`.
- **Imports:** Use explicit vitest imports (`import { describe, it,
  expect, vi } from "vitest"`).
- **Setup:** `apps/web/src/tests/setup.tsx` provides
  `renderWithProviders()`, `renderWithRouter()`, and `MemoryRouter`, and
  gives the test `QueryClient` `retry: false` (a failed query surfaces
  its error immediately), so error paths are testable and under-mocked
  tests fail loudly rather than sitting through retries.
- **Test doubles** split two ways by what they do, and a helper lives
  in exactly one of them:
  - `src/tests/fake/` — `createFake*` data generators. No mocking.
  - `src/tests/server-fn/` — `vi.fn()` stubs over the TanStack Start
    server functions, named `mock<ServerFnName>` after the function
    they stub. Returns the `vi.fn()` itself, so assert with
    `expect(getUser).toHaveBeenCalled()`.

  Files under `server-fn/` mirror the mocked
  `@server/<feature>/functions` module, not the client feature —
  `getAccount` is stubbed from `server-fn/users.ts`. The SPA has no HTTP
  client, so there is no HTTP mocking library either: stub the module
  that would make the call, never an interceptor. Nothing blocks an
  outbound request, so a test that reaches the network really will.

  **Both directories are browser-side only.** Workflow data generators,
  jobs API fakes and process fakes live in the harness under
  `packages/workflow/src/testing/` and are imported from
  `@virtool/workflow/testing`. No test double lives in two places, and
  `apps/web/src/tests/` gains nothing from a workflow fixture.
- **Database tests:** `createTestDatabase()` from
  `@virtool/data/db/test/fixtures` gives a suite its own isolated
  Postgres database with the schema applied, and installs the
  `client_events` emitter on it. Test files run in parallel, so never
  share one database between them. A test that stubs
  `@virtool/data/events/emit` must stub `createEmitter` alongside `emit`,
  or the fixture's install call finds nothing to call.
- **Server functions:** a test cannot call a server function by
  importing it — the Vite plugin moves the handler body into a virtual
  `?tss-serverfn-split` module, so invoking the import runs none of your
  code and a naive test passes while asserting nothing. Import the split
  module and call it through `callServerFn` from `@server/test/serverFn`
  (`groups/functions.test.ts` is the worked example).
- **Assertions:** Use explicit `expect()` assertions, not snapshots.
- **User interaction:** Use `@testing-library/user-event` over
  `fireEvent`.
- **Queries:** Prefer accessible queries (`getByRole`,
  `getByLabelText`) over `getByTestId`; don't disambiguate by index.
- **Accessibility:** `expectNoViolations(container)` from
  `src/tests/axe.ts` runs axe-core over a rendered subtree. Opt-in per
  test, not auto-run in `renderWithProviders`; `color-contrast` is off by
  default (jsdom has no layout engine). Re-enable it in a `*.a11y.test.tsx`
  file — those run in the browser `a11y` project — via
  `expectNoViolations(el, { rules: { "color-contrast": { enabled: true } } })`.

See [docs/testing.md](docs/testing.md) for the unit / integration
layer split, where to mock the network boundary, snapshot guidance, the
axe-core accessibility helper, and the shared-fixtures rule.
## Process

### Documentation

`AGENTS.md` is the index. It carries the rules an agent needs to
start work — terse statements with pointers into `docs/` for the
full treatment. Detailed explanations, examples, and rationale live
in `docs/`.

**Every app and every package has a `README.md`, and it is the human
entry point, not a third copy of the rules.** An app's says what the app
is, its port and image, and its commands; a package's says what it
exports and where it may be imported from. Both then carry the decisions
particular to that directory which no shared doc owns, and point at the
`docs/` leaves — a README is the one place allowed to name a doc,
because it is an entry point rather than a leaf.

**`AGENTS.md` is updated in the same commit as the change that
invalidates it.** It is the first file every agent and contributor
reads. A stale line does not merely fail to help — it actively
misleads, sending readers to deleted files and dead APIs.

Before committing, check whether your change contradicts anything in
this file. It does if you have:

- removed, added, or replaced a dependency listed under **Key libraries** in
  `apps/web/README.md`;
- deleted, moved, or renamed a file or directory named anywhere in this
  document;
- added or removed a top-level feature directory under `apps/web/src/`;
- changed a command in the **Commands** table, or changed what one does;
- added, removed, or changed a lint rule this file describes as enforced;
- changed the shape of an API this file tells agents to call.

"I'll update the docs afterwards" is how a doc goes stale. There is no
afterwards — the commit that removes the last `styled.` call site is the
commit that removes styled-components from this file.

**When to update what:**

- New behavioural rule or convention → add a one-line statement in
  the right `AGENTS.md` section and put the detail in the matching
  `docs/<topic>.md`. Create a new doc only when no existing one
  covers the area.
- Change to behaviour described in a doc → update the doc in the
  same commit. `docs/` goes stale the moment the code it describes
  changes.
- A section in `AGENTS.md` keeps growing → move the detail into a
  doc and leave a one-or-two-line pointer behind.
- A doc grows past one cohesive topic, or starts pulling in
  unrelated material to stay self-contained → split it along the
  mixed-concerns line so each half is again a leaf.
- New app or package, or a change to an app's port, image, surface or
  commands, or to what a package exports → update that directory's
  `README.md` in the same commit.

### Git

Commit messages use **Conventional Commits**. Releases are automated with
semantic-release: only `feat` (minor) and `fix` (patch) trigger a release.
Anything user-visible must be one of those — never `refactor` or `chore`.

```
type(scope): description
```

#### Types

- `feat`: new user-facing feature or capability
- `fix`: bug fix or correcting wrong behavior (includes UI adjustments and
  performance improvements)
- `chore`: internal code not yet exposed to users (e.g., new hook, data model),
  configs, dependencies, file moves/renames, build scripts
- `refactor`: restructuring code without changing behavior (e.g., extracting
  functions, renaming variables, reorganizing modules)
- `style`: formatting only — no logic changes
- `docs`: documentation changes only
- `test`: adding or updating tests
- `ci`: CI/CD pipeline changes

#### Titles

`feat` and `fix` titles are user-facing. Describe the outcome for the user,
not the code change. Implementation details go in the body, not the title.

- Bad: `fix: use shared Button component with corrected label`
- Good: `fix: correct submit button label`
- Bad: `feat: wrap save handler in a transaction`
- Good: `fix: prevent rare data loss when saving`

All other types are developer-facing — implementation details are helpful
and make commits easier to find later.

- Good: `refactor: extract form helpers into src/forms/`
- Good: `chore: add csv parser`
- Good: `test: add tests for table components and hooks`

#### Other rules

- Title: lowercase, no period, under 72 characters.
- Scope is optional. Allowed scope: `deps` (dependency changes). Do not scope
  by domain.
- Don't push or create PRs unless asked.
- Don't include a Test plan section in pull request descriptions or comments.
- Don't use `git -C <path>` unless necessary. It triggers permission prompts
  that aren't worth the trouble. Run git commands from the working directory
  instead.

#### GitHub

- PR titles must follow Conventional Commits format so they can be cleanly
  squash-merged into a single well-formed commit.

### Linear

- **Team**: Virtool
- **Team ID**: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`
- **Issue prefix**: `VIR`

#### Issue conventions

- Capitalize issue titles.
- Place issues in **Todo** by default; use **Backlog** only when explicitly
  asked. If an issue seems like it should be Backlog, say so and ask.
- Never assign issues to anyone.
- **Never change an issue's status.** Status is managed automatically from
  branch and PR activity. Move an issue by hand only when explicitly told to.
  The Todo-by-default rule above governs issues you create, not ones already
  in flight.
- Label bugs as **Bug** in addition to any other labels.
