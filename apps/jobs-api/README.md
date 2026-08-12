# @virtool/jobs-api

The jobs API: the service workflow runners call to claim, run and finish jobs.
A [Hono](https://hono.dev) app on `@hono/node-server`, port **9950**, mirroring
Python's `virtool/jobs/main.py`. It runs as `api-jobs-service` behind a
ClusterIP with **no ingress** — that absence is the security boundary, and
nothing outside the cluster can reach it.

Image: `ghcr.io/virtool/jobs-api`.

It is called "the jobs API" everywhere: the directory, the package
(`@virtool/jobs-api`), the image, the Kubernetes service, the Sentry `service`
tag, the pino logger `name`, and the `application_name` it connects to
Postgres under. "Control plane" describes its role; it is not a second name
for it. Python and the workflow runtime already call it the jobs API, and a
service with two names across two repositories is a service nobody can grep
for.

It serves records, never bytes: a read hands back the recorded `storageKey`
and the workflow fetches the object itself.

## Surface

| Group | Routes |
| --- | --- |
| Probes | `GET /health/live`, `GET /health/ready` |
| Metrics | `GET /metrics` (bearer, `VT_METRICS_TOKEN`) |
| Job lifecycle | `POST /jobs/claim`, `GET /jobs/{id}`, `PUT /jobs/{id}/ping`, `POST /jobs/{id}/steps/{stepId}/start`, `POST /jobs/{id}/finish` |
| Caches | `GET /caches/{key}`, `POST /caches` |
| Finalize | `PATCH /subtractions/{id}`, `PATCH /samples/{id}`, `PATCH /analyses/{id}` |
| Metadata | `GET /samples/{id}`, `/subtractions/{id}`, `/indexes/{id}`, `/analyses/{id}`, `/refs/{id}`, `/settings` |

There is no delete and no failure route. Cancelling a job, deleting one and the
five-minute stalled-job sweep all stay Python's.

Every route must refuse an unauthenticated caller or be named in
`PUBLIC_ROUTES`; `src/__tests__/authorization.test.ts` enforces that.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/jobs-api build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/jobs-api start` | Run the bundle |
| `pnpm --filter @virtool/jobs-api test` | Run the Vitest suite (needs Docker — Postgres testcontainer) |
| `pnpm --filter @virtool/jobs-api typecheck` | `tsc --noEmit` |

## Why it is a separate service

It mirrors the topology Python already has — `virtool/jobs/main.py`, a
separate aiohttp app served as `api-jobs-service` on 9950 — and the port
matches so the two can be swapped behind the same ClusterIP.

Two things follow from the split that do not follow from a shared process:

- **A bug in the job-key guard is not remotely exploitable.** The
  runner-facing surface is not reachable from the internet at all, so a
  mistake in the credential check is a cluster-internal problem rather than a
  public one.
- **Workflow traffic and page-load traffic get separate pools and scale
  independently.** A burst of runners claiming jobs cannot exhaust the
  connection pool the SPA's page loads depend on, and neither side's replica
  count is hostage to the other's load.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Entry point: config, Sentry, pool, server, shutdown wiring |
| `src/app.ts` | `createApp` — the Hono app, its middleware and its routes |
| `src/config.ts` | Environment parsing, including every `<KEY>_FILE` variant |
| `src/instrument.ts` | Sentry initialisation and the `SERVICE` constant |
| `src/logger.ts` | `createAppLogger` — the pino logger and its Sentry stream |
| `src/auth/verify.ts` | `verifyJobRequest` — the job credential check |
| `src/auth/guard.ts` | `requireJobRequest` — the guard every handler starts with |
| `src/auth/test/fixtures.ts` | `seedJob` — a job row and the plaintext key for it |
| `src/jobs/handlers.ts` | The five lifecycle routes |
| `src/caches/handlers.ts` | Cache lookup and registration |
| `src/http.ts` | `jsonError`, `parseJsonBody`, `requireRowId`, and the `ReadHandlerDeps` a read takes |
| `src/manifest.ts` | `checkManifest` and `measureManifest` — the finalize manifest checks |
| `src/finalize.ts` | `finalizeResource` — the sequence all three finalize routes run |
| `src/samples/handlers.ts` | Sample read and finalize |
| `src/subtraction/handlers.ts` | Subtraction read and finalize |
| `src/analyses/handlers.ts` | Analysis read and finalize |
| `src/indexes/handlers.ts` | Index build read |
| `src/references/handlers.ts` | Reference read |
| `src/settings/handlers.ts` | Instance settings read |
| `src/metrics/registry.ts` | `createMetrics` — this process's Prometheus registry |
| `src/metrics/jobs.ts` | `createJobQueueReader` — the memoized job-queue read |
| `src/metrics/handler.ts` | Token check, pre-scrape reads, response |
| `src/__tests__/authorization.test.ts` | The route-enumerating authorization floor |

Nothing is constructed at import time. `createApp` and `createMetrics` are
factories taking their dependencies as arguments, the same rule
`@virtool/data` and `@virtool/storage` follow — which is what lets the
authorization test build a whole app over fakes without opening a pool.

## Hono, and why

The handlers this service grows are ported from raw-route handlers already
written against Web `Request`/`Response`, so they move across verbatim. Hono
is a thin router over exactly those types; Express and Fastify would each
have meant rewriting every handler against a framework-specific request
object for nothing.

`@hono/node-server` adapts the app to `node:http`. `serve()` returns a Node
server, which is what the `SIGTERM` handler closes.

## The authorization floor

`src/__tests__/authorization.test.ts` enumerates `app.routes` and requires
**every route** either to refuse an unauthenticated request — 401, 403, or
404 — or to be named in `PUBLIC_ROUTES` in `app.ts`, with a comment saying
why.

A route added without a floor therefore fails the build, by name, rather
than shipping open. That test landed with the skeleton and before any
endpoint, deliberately: a guard added after the endpoints it guards is a
guard written to match whatever those endpoints already do.

`PUBLIC_ROUTES` holds exactly three entries:

- `/health/live`
- `/health/ready`
- `/jobs/claim`

The first two are Kubernetes probes. The kubelet presents no credential, and
a readiness probe that could fail closed on an auth problem would take the
pod out of service for the wrong reason. Neither reveals anything beyond
whether Postgres answers.

`POST /jobs/claim` is public because it has to be. The key a runner
authenticates every later request with is minted by that call and returned
in its response, so a caller has nothing to present yet — a pod started by a
KEDA `ScaledJob` knows neither its job id nor its key until it claims.
Python's `ClaimJobView` carries `PublicRoutePolicy` for the same reason. What
bounds it is the network: this service has no ingress, so reaching the
endpoint at all means already being inside the cluster.

`/metrics` is deliberately **not** in that list. It enforces its own bearer
token and is expected to refuse like everything else.

The test also asserts the reverse: every `PUBLIC_ROUTES` entry names a route
that actually exists. A stale exception is as much a bug as a missing one —
it reads as a deliberate decision about a route that is no longer there.

## The job credential

A workflow pod authenticates as the job it claimed, over HTTP Basic:

```
Authorization: Basic base64(job-{jobId}:{key})
```

`verifyJobRequest` (`src/auth/verify.ts`) resolves that to a `JobPrincipal` —
`{ jobId }`, and nothing else. There is deliberately no `userId` and no
permission set on it. A pod acts as its job, not as the user who created the
job, and every rule this service enforces is a rule about which job may touch
which row; carrying the owner would invite a handler to authorize against
them instead.

The sequence, in order:

1. Read the `Authorization` header. Missing is a failure.
2. Parse it as Basic. A non-Basic scheme, undecodable base64, a missing `:`,
   or an empty login is a failure.
3. Match the login against `/^job-([1-9]\d*)$/` — **anchored and
   case-sensitive**. The digits are spelled the way `parseRowId` spells them,
   so a row id has one spelling on both parsers: `job-007` is not a login for
   job 7, and `job-0` never reaches the range screen.
4. Screen the id: no larger than a Postgres `integer`.
5. Read `key` and `state` for that id, in **one** query.
6. Fail if `key` is null — that job was never claimed.
7. Compare `hashToken(key)` to the stored digest with `timingSafeEqual`,
   behind a length screen.
8. Fail if `state` is terminal.

**There is no cookie fallback, ever.** This service has no session model, and
nothing that reaches it holds a browser session.

`requireJobRequest` (`src/auth/guard.ts`) wraps it and is what a handler
calls. On failure it **returns** `401 Unauthorized` rather than throwing — a
thrown refusal would have to be caught somewhere, and that somewhere also
catches genuine bugs, so a handler crashing halfway through would answer 401
and read as a credential problem to the runner and to Sentry alike. The 401
carries **no `WWW-Authenticate` header**: that header exists to make a
browser prompt, and a runner's key is minted once, at claim time, so there is
nothing an interactive retry could supply.

Every failure short of a correct key returns an identical, opaque 401 with
the body `Unauthorized`. Nothing distinguishes an unknown job from a wrong
key — the most useful thing a caller could otherwise learn is which job ids
exist.

The one refusal that says more is a job that has finished, and it is safe
because of **where it sits**: the terminal-state check is step 8, after the
key comparison at step 7, so only a caller already holding that job's key can
reach it. Its body is JSON naming the state:

| State | Body |
| --- | --- |
| `cancelled` | `{"message": "Job is cancelled."}` |
| `failed` | `{"message": "Job has failed."}` |
| `succeeded` | `{"message": "Job has succeeded."}` |

The states and their messages are one structure in `verify.ts`, not two, so a
state cannot be terminal for the purposes of refusing a key and unknown for
the purposes of saying why.

### Terminal state is the whole of key revocation

A key has no expiry, no revocation list and no rotation: `jobs.key` holds one
digest for the life of the row. Reaching `cancelled`, `failed` or `succeeded`
is the **only** thing that stops it authenticating, which is why the state is
re-read on every request rather than trusted at claim time. A runner pod that
outlives the job it claimed still holds a syntactically valid credential, and
that check is what stops it being accepted.

**This is also the cancellation channel, and the whole of it.** A running
workflow has no other way to learn it should stop: it pings every five
seconds, and the ping it gets a 401 for is the signal. There is deliberately
no `cancelled` flag on the ping response — a flag would have to be readable
by a credential the same transition revokes, and it would speak only for
`cancelled`, when a job swept up by the ping timeout is `failed` and its
runner has to stop just as surely.

That is why the refusal names the state. The runner's behaviour is identical
for all three, so it does not parse the message; it logs it. A 401 is also
what a genuinely broken credential produces, and a pod stopping on `Invalid
credentials` rather than `Job is cancelled.` is a bug that would otherwise be
invisible.

### The two local copies

`hashToken` and `parseBasicAuthHeader` are reimplemented in
`src/auth/verify.ts` rather than shared, each with a comment naming its
counterpart, and each pinned by fixed-vector tests.

`parseBasicAuthHeader` has no choice: its counterpart is in
`apps/web/src/server/auth/verify.ts`, which this service must not reach
into. `hashToken`'s counterpart is `@virtool/data/auth/tokens`, and both
mirror Python's `hash_key` at `virtool/utils.py:98-99`. All three must
produce the same digest forever — Python writes the column this side reads —
so the test pins fixed digests rather than comparing the two TypeScript
copies, which would pass just as happily if both drifted away from Python
together.

The `seedJob` fixture hashes with **`@virtool/data`'s** `hashToken`,
deliberately. Seeding with the copy under test would make the verifier agree
with itself no matter what either did; going through the shared one means a
test that authenticates successfully has also shown the two agree.

## Health

| Route | Meaning |
| --- | --- |
| `GET /health/live` | The process is up. Always `200`, no I/O. |
| `GET /health/ready` | `200` when Postgres answers, `503` when it does not. |

Readiness folds `checkPostgres` through `summarizeReadiness` from
`@virtool/data/health/data` — the same pair `apps/web` uses, so the two
services' probes cannot drift. Neither route requires the metrics token: a
probe that needed a credential would be one more thing to get wrong during a
rollout.

Readiness also answers `503` from the moment shutdown begins, before the
listener closes and **without querying**, through the `isReady` predicate on
`AppDeps`. That is what takes the pod out of the Service's endpoints while
there is still a listener there to say so; a claim arriving after that point
would be held by a process on its way out.

## The job lifecycle

Five routes carry a run from start to finish. Paths match Python's byte for
byte, with no prefix — a separate app has no SPA to collide with.

| Route | Meaning | Statuses |
| --- | --- | --- |
| `POST /jobs/claim?workflow=` | Take the oldest waiting job | `200`, `404` none waiting, `422` unclaimable workflow |
| `GET /jobs/{id}` | Read the job, and its `args` | `200`, `403`, `404` |
| `PUT /jobs/{id}/ping` | Heartbeat | `200`, `401` terminal, `403`, `404` |
| `POST /jobs/{id}/steps/{stepId}/start` | Stamp a step's start time | `200`, `403`, `404`, `409` |
| `POST /jobs/{id}/finish` | Move a running job to `succeeded` | `200`, `403`, `404`, `409` |

Every field crossing this wire is camelCase; the `claim` and `steps` JSONB
columns underneath stay snake_case, because Python reads and writes the same
bytes. `fromStoredJobClaim` / `fromStoredJobStep` in `@virtool/contracts` are
the only crossing points, and a route must never return a JSONB element
straight out of the column.

Those two mappers, and the `JobStep` / `JobClaim` / `StoredJobStep` /
`StoredJobClaim` shapes they run between, live in
`packages/contracts/src/jobs.ts` rather than in `jobsApi.ts`. They are not
this service's contract: the web app publishes the same two shapes to the
SPA, off the same JSONB column, through the same mappers, and a second
implementation of that conversion is exactly the kind of drift one
definition prevents. `jobsApi.ts` holds only what is genuinely the jobs
API's — the request bodies, the responses, and the `Workflow*` metadata
reads.

### The job shapes are parsed on the way out

`jobs.workflow` is a plain `text` column with no CHECK constraint, so the
data layer types it `string` while the wire types it as a union. `toJob`
therefore **parses** the response through the `Job` schema rather than
asserting it into shape, and a row that does not fit is thrown: `app.onError`
logs it, hands it to Sentry and answers `jsonError(500, "Internal server
error")`. The message names the job id and the failing field paths — never
the values, because a message is a Sentry title and row content does not
belong in one.

Failing the read is not new strictness. `@virtool/workflow`'s client parses
what it receives with that same schema — one `Job` serves this service, the
web app and the runtime alike — so an unrecognised workflow was already a
hard `JobsApiError` — raised at a runner that can do nothing about it, on the
far side of a retry policy. Parsing here puts the failure on the side that
owns the data, where it is one Sentry issue naming a row rather than a pod
that claimed a job and died.

`JobClaimed` needs no parse of its own. `toJobClaimed` takes the `workflow`
the handler already validated off the query parameter with
`ClaimableJobWorkflow`, and every other field it builds is a literal or
already narrow.

**Nothing else in the service validates a response.** A blanket
outbound-validation layer would tax every route for a looseness that exists
on one column.

### Claiming is a lock, not a query

`claimJob` (`@virtool/data/jobs/data`) selects the oldest row matching the
workflow with `acquired = false` and `state = 'pending'`, under `FOR UPDATE
SKIP LOCKED` over a one-row window, then flips `acquired`, `claim`,
`claimed_at`, `key`, `pinged_at`, `state` and `steps` in the same
transaction.

`SKIP LOCKED` is what makes a fleet starting together safe: each runner
locks a different row rather than queueing on the same one and then finding
it taken. Without it a wave of pods serialises, and every one but the first
wakes to a row that is no longer pending.

The key is 32 random bytes as hex (`newJobKey`, matching Python's
`secrets.token_hex(32)`), and only its SHA-256 is written. The plaintext is
returned in the claim response and **never again** — no read endpoint
carries it, and a runner that loses it cannot finish its job.

`build_index` is refused at claim with `422`. The rows exist and must still
parse on the read path, but Python builds indexes through the `create_index`
*task* now, not a job, so nothing is waiting on that workflow and handing one
out would start a pod nothing finishes. `ClaimableJobWorkflow` in
`@virtool/contracts` is the narrowed enum the query parameter is validated
against, and `@virtool/workflow`'s `VT_WORKFLOW` reads the same one.

### Progress is derived, never stored

There is no `progress` column. A job's progress is the fraction of its steps
that have started, computed on read by `computeJobProgress` in
`@virtool/contracts` — terminal is 100%, running is `floor(started / total *
100)`, everything else is 0. That is what makes starting a step twice a
`409` rather than a no-op: a silent restamp would move a job's progress
without moving its work.

A step's `started_at` lives inside the `steps` JSONB array, which SQL cannot
address one element of, so the whole array is read, one element replaced,
and the whole array written back. The row is held `FOR UPDATE` across that
read-modify-write — two steps starting at once would otherwise each write an
array built from the state before the other, and the loser's timestamp would
vanish.

### The job in the path must be the job in the credential

A mismatch is **403**, from `requireOwnJob` in `src/jobs/handlers.ts`.
Python enforces this inside its auth middleware; here it is the handlers'
job, because it is a rule about a route's path rather than a property of the
credential — which is what `JobPrincipal` carrying `jobId` is for.

403 rather than 404: the caller authenticated successfully and is asking
about a job that is simply not its own. Hiding the job's existence would buy
nothing, because a runner holding a valid key already knows job ids are
consecutive integers.

## Caches

Workflows reuse expensive derived artifacts — trimmed reads, mapping
indexes, collapsed references — through the `caches` table, which Python
owns at `virtool/caches/pg.py` and `@virtool/data` mirrors read-only.

| Route | Meaning |
| --- | --- |
| `GET /caches/{key}` | Resolve a logical key to its row. `404` on a miss. |
| `POST /caches` | Register a row for a blob the caller has already written. |

Both paths match Python's, with no prefix — a separate app has no SPA to
collide with. Each handler calls `requireJobRequest` itself; nothing runs
middleware on its behalf.

**Neither endpoint carries cache bytes.** Workflows have direct
object-storage access, so the writer puts its blob at `caches/v1/<uuid>` and
then registers the row, and the reader takes `storageKey` to the bucket.
Python streamed payloads through its jobs API; this does not.

The lookup is handed `ReadHandlerDeps` — `{ db }` — like every other read in
the service, so it has no backend to reach even by mistake.
`CacheHandlerDeps`, with `storage` and a logger, belongs to the register
route alone, which reads the blob's size back to write the row with it.

**Lookup is not optional garnish.** A row's `storageKey` is a per-write UUID
and is not derivable from the cache key, so a workflow holding a derived key
cannot read the blob at all until this server resolves one to the other. It
is on the hot path of every workflow start, which is why `getCache` refreshes
`last_accessed_at` only when it is older than five minutes — Python's
`LAST_ACCESSED_REFRESH_INTERVAL`, and the same threshold on both sides
because both read the same rows. An unconditional `UPDATE` would turn every
read into a write.

### The wire carries a UUID, never a storage key

`POST /caches` takes `{ key, uuid, params }`, and the server composes the
storage key with `cacheKey(uuid)` from `@virtool/storage`. The uuid is
validated as 32 lowercase hex characters.

This is not stylistic. A caller-supplied `storageKey` would let a
job-authenticated caller register a cache row pointing at a sample, index or
subtraction object — and Python's LRU eviction deletes by `storage_key`, so
that is a route to having another domain's files destroyed. Composing the
key from a validated uuid makes it unrepresentable.

The uuid must also be **fresh per write attempt**, never derived from the
cache key, so that the loser of a race can delete its own orphan without
touching the winner's object.

### Verify, then transact

`registerCache` calls `storage.size(cacheKey(uuid))` **before** any database
work, and stores the size it read. A caller declaring a blob it never wrote
gets `400` and leaves no row behind; a caller sending a size is simply
ignored — the field is not on the contract. No storage call happens inside a
transaction.

### Losing the race is success

Two workflows can legitimately derive the same cache key at once, and both
blobs hold the same bytes, so **"already existed" is a 2xx** — 201 when the
call created the row, 200 when it did not, plus a `created` flag in the body
for logging.

The insert uses `onConflictDoNothing({ target: caches.key })`, targeting the
`cache_key` constraint **specifically**. A bare `onConflictDoNothing()`
would also swallow a `storage_key` collision, which can only mean a reused
uuid — a bug, and one that would leave two logical caches sharing one
object.

When the insert takes no row, the loser re-selects by `key` and returns the
**winner's** row, so it reads the blob that actually survived. It then
deletes its own orphan, after the write has committed, logging a failure
rather than throwing. That is necessary because an orphan has no row, so
Python's LRU eviction, which walks rows, will never reclaim it.

**The delete is guarded on the winner's `storage_key` differing from the one
this call composed.** A retry — a lost response, an ordinary client retry —
arrives with the *same* uuid, so it re-selects its own row and the object it
would delete is the live one that row names. Deleting there leaves a row
pointing at nothing: unreadable to every later lookup, and unrepairable by
eviction, which walks rows and would find this one perfectly intact. The
guard is what makes `POST /caches` idempotent rather than merely
conflict-tolerant.

This deliberately diverges from Python, which raises
`CacheAlreadyExistsError` on the same race. The divergence is the reason the
loser path is handled explicitly rather than left to an error handler.

### Eviction stays in Python

No eviction, storage-budget accounting or scheduled cleanup lives here.
`CACHE_EVICTION_GRACE_PERIOD`, `select_eviction_candidates` and the periodic
task in `virtool/caches/` remain Python's. The only deletion this service
performs is the loser's own orphan.

## Finalize

A workflow writes its outputs to object storage itself and then makes
**one** call per resource, carrying that resource's finalize fields
alongside a manifest of what it wrote. Python needed roughly twenty per-file
upload endpoints for the same job.

| Route | Body | Rows written | Parent update |
| --- | --- | --- | --- |
| `PATCH /subtractions/{id}` | `FinalizeSubtractionRequest` | `subtraction_files` | `count`, `gc`, `ready` |
| `PATCH /samples/{id}` | `FinalizeSampleRequest` | `sample_reads` | `quality`, `ready` |
| `PATCH /analyses/{id}` | `FinalizeAnalysisRequest` | `analysis_files` | `results`, `ready`, `updated_at` |

`index_files` is **not** here. Index builds are still started by
`createIndex` and finished by Python's `create_index` task runner, which
writes the artifact and its file rows itself.

The manifest rides along with the finalize call rather than arriving as a
separate step, so a run cannot end with the parent flipped `ready` and its
file list missing. Each handler is an ordinary `Request → Promise<Response>`
in `apps/jobs-api/src/<feature>/handlers.ts`; the row work lives in
`@virtool/data`, typed `DbOrTx`, because it is the same data layer the web
app reads through.

All three run one sequence — authenticate the job, resolve the id, parse the
body, check the manifest against the resource's prefix, measure every object
it names — and it is written once, as `finalizeResource`
(`src/finalize.ts`). A route hands in the four things that are its own: the
prefix, the filenames it accepts, the classes the data layer reports its
outcomes with, and a `write` callback carrying the rest — the data function
it calls, the columns it maps each measured entry onto, and the line it
logs. The statuses are **not** a route's to choose. `notFound` is 404,
`notOwned` 403 and `alreadyFinalized` 409 for all three, because a resource
picking its own would be a resource whose ownership check said something
different from the other two's.

### Only the job that produced a resource may finalize it

The metadata reads take no ownership check — which jobs may read which rows
is not a question this service answers — but the writes do. Without it,
every running job holds a credential that would flip *any* sample,
subtraction or analysis ready and hang file rows off it, and there are
always several running.

The owning job is recorded on the row itself: `legacy_samples.job_id`,
`subtractions.job_id` (both `UNIQUE` — a create job produces exactly one
resource) and `analyses.job_id`. Each finalize function in `@virtool/data`
therefore takes a `jobId` positional after the resource id, and the handler
passes `principal.jobId`.

**The predicate rides on the `UPDATE`, not a read before it.** The `WHERE`
already carried `id = ? AND ready = false`; ownership joins it as `AND
job_id = ?`, so there is no window between checking and writing and no
extra statement. The fallback `SELECT` that already told a missing row from
a finalized one reads `job_id` too, so the disambiguation still costs one
query.

Its checks run in a fixed order — **404, then 403, then 409**:

| Fallback finds | Answer |
| --- | --- |
| no row (or, for a subtraction, `deleted`) | `404` |
| `job_id` is not the caller's, or is null | `403` |
| otherwise | `409` |

403 last-but-one and 409 last is the whole point: a row a job does not own
must not report whether it has been finalized. A null `job_id` — a resource
created before jobs, or by hand — is not owned by whoever asks, so it is a
403 as well.

403 rather than 404 matches `requireOwnJob` on the lifecycle routes, and for
the same reason: the caller authenticated, and hiding the row's existence
buys nothing against a client that already knows ids are consecutive
integers.

`POST /caches` is deliberately exempt. A cache row is shared derived work;
no job owns one.

### A resource that is unusable without its files must carry them

Riding the manifest along with the parent update only prevents "parent
ready, file rows missing" if the manifest cannot be empty. Two of the three
refuse an empty array, and the bound lives on the contract in
`@virtool/contracts` so the workflow runtime cannot build the call:

| Resource | Manifest | Why |
| --- | --- | --- |
| Sample | `.min(1).max(2)` | A `create_sample` run writes `reads_1.fq.gz` and, for a paired library, `reads_2.fq.gz`. Zero reads is not a sample; three is not an outcome. |
| Subtraction | `.min(1)` | One whitelisted name plus the duplicate check makes the source FASTA exactly-once. |
| Analysis | unbounded | Legitimately empty. Pathoscope's entire output is the `results` blob and it retains no files at all; NuVs is the workflow that writes FASTA and HMM outputs. `results` being required is the guard here. |

### The wire carries a storage key, and the row records it verbatim

This is the opposite of what `POST /caches` does, and the difference is
deliberate.

The cache rule exists because a cache row's key is *derivable* — it is
`caches/v1/<uuid>` and nothing else — so composing it server-side costs
nothing and makes a cross-domain row unrepresentable. A finalize key is not
derivable: the workflow already wrote the bytes somewhere, and composing a
second key here would put a second opinion about where they went next to
the writer's, free to disagree. The size check would then surface that
disagreement as a confusing `400` rather than as the key mismatch it is.

Nor is there a boundary to defend. The principal is a workflow pod holding
the **same unscoped `VT_STORAGE_*` credentials** as the web app and Python —
no per-job prefix, no scoped token — issued to the same pod at the same time
as its job key. A compromised pod deletes objects directly; it has no reason
to launder a deletion through a manifest.

What remains is a check against buggy key interpolation, and it is a prefix
check. Every key must sit under `{domain}/{parentId}/` for the resource
named in the route's **own path** — `subtractions/{id}/`, `samples/{id}/`,
`analyses/{id}/` — which is exactly what `mintStorageKey(domain, parentId)`
produces, so both sides stay on one builder. Alongside it, structural checks
reject an empty key, a leading `/`, an empty segment and a `..` segment.
`apps/jobs-api/src/manifest.ts` holds all of it.

Filenames are checked too, but only as filenames: no `/`, no traversal
segment, and — for subtractions and samples — against the same whitelists
Python enforces, because Python's download endpoints address those rows by
`name`.

| Resource | Accepted names |
| --- | --- |
| Subtraction | `subtraction.fa.gz` |
| Sample | `reads_1.fq.gz`, `reads_2.fq.gz` |
| Analysis | any plain filename — the workflow names its own outputs |

#### A subtraction accepts one name, not Python's seven

Python's `virtool/subtractions/utils.py:FILES` names seven — the source
FASTA plus the six shards of a bowtie2 index — and this route accepted all
seven until it was narrowed to the FASTA alone.

**Nothing consumes the shards.** Both analysis workflows build a
subtraction's bowtie2 index locally from the `.fa.gz` and memoize it through
their own workflow cache — `workflow-pathoscope`'s
`create_subtraction_index` and `workflow-nuvs`'s
`create_subtraction_indexes` — and neither touches
`WFSubtraction.bowtie2_index_path`, which is defined and never read. The
shards are written by one workflow and read by none. Python's own
`create_subtraction` compounds it: its upload glob is `*.bt2`, and
`bowtie2-build` emits `.bt2l` for a large genome, so a large subtraction has
been uploading nothing but the FASTA for as long as that has been true.

There is no parity constraint to hold either. This service has no per-file
upload route, so Python's `create_subtraction` cannot finalize against it at
all; `apps/create-subtraction` is the only writer this route will ever have.

**This is the write path only.** Every subtraction Python finalized carries
`bowtie2` rows, `GET /subtractions/{id}` keeps serving them with their
`type`, and `SubtractionFileType` keeps both members. A read that stopped
reporting the shards would break nothing on the workflow side and would
still be a lie about the row.

With one name whitelisted, the duplicate check in `checkManifest` and the
non-empty manifest the contract requires, the FASTA arrives exactly once —
so the row's `type` is written `"fasta"` outright rather than derived from
the extension.

### The manifest declares neither a size nor a name on disk

`size` is not on the contract. Every row is written with the byte count the
route read back from `storage.size()`, which is what makes "a row pointing
at nothing" impossible, so a declared size would be a field nothing stores
and nothing checks.

`name_on_disk` is derived as well. A reads file repeats its `name`, matching
Python. An analysis file gets `{uuid}-{name}`, following the `createUpload`
precedent rather than Python's post-flush `{id}-{name}`, which needs the row
id and so a second write — the column is unique across the whole table, so
it cannot simply be the workflow's filename. A subtraction file's `type` is
not on the contract either: the whitelist admits `subtraction.fa.gz` and
nothing else, so the row is written `"fasta"` outright.

### Verify, then transact

Every `storage.size()` call for a manifest completes **before**
`db.transaction(...)` opens, and the transaction holds Postgres work only. A
manifest naming a blob that is not in the bucket answers `400` having
written no rows and made no parent update.

`subtraction/handlers.test.ts` asserts the ordering rather than assuming it:
`createTestDatabase({ onQuery })` and a `MemoryStorage` wrapper put SQL
statements and storage reads on one timeline, and the test requires every
`size()` to precede the `BEGIN`. Without that, a check that slipped inside
the transaction would hold a pool connection across a round trip to the
bucket, and a missing blob would abort a transaction that had already
written rows.

### 409, not idempotent

Each parent update is conditional — `WHERE id = ? AND job_id = ? AND ready =
false`, plus `AND deleted = false` for a subtraction — and its row count is
checked. A zero row count re-selects the row to tell the cases apart, in the
order given above: gone or soft-deleted is `404`, someone else's is `403`,
already finalized is `409`. Python makes the same not-found/already-finalized
split, and a second finalize must not be quietly accepted: these calls write
file rows, and accepting one twice writes the set twice.

### Finalizing a sample destroys its input uploads

Matching Python. The `sample_uploads` rows are marked `removed`/`removed_at`
**inside** the transaction and their blobs deleted **after** it commits,
with `deleteKeys` failures logged rather than failing a finalize that
already happened.

Marking without deleting is the tempting middle ground and it is wrong.
`removed = true` already means "the bytes are gone" everywhere else —
`deleteUpload` marks the row and deletes the object in one call — so a
removed row still naming a live object is invisible to the UI *and* to any
orphan sweep, because the object is named by a row. Those bytes leak
permanently, at one full duplicate of every sample's input reads. Deleting
is safe because `reserveUploads` rejects an already-reserved upload, so an
upload belongs to exactly one sample and no other row can name that blob.
`reserved` is deliberately left alone; `removed` gates every read path.

A read's source upload is **derived, not declared**: `sample_uploads.index`
is the position an upload held in the create request, and the workflow
writes them out in that order as `reads_1` and `reads_2`, so the link is by
position. There is no wire field with which a runner could name another
sample's upload.

### Subtractions reach the browser over SSE

`emit(...)` runs after each commit, never inside. Analyses emit a `samples`
update alongside their own, because a sample's workflow tags are derived
from its analyses.

Subtractions had no SSE domain at all before these routes existed, so one
was added: `subtractions` in `SseDomainSchema` **and** a `frame("subtractions",
NumberId)` in `SseMessageSchema` (`packages/contracts/src/sse.ts`), plus the
matching entry in `reactQueryHandler`'s `domains` record. **No Python change
was needed** — Python publishes free-form domain strings onto `client_events`
and has been emitting `subtractions` all along; the client was dropping the
frames because its schema did not accept them.

## Metadata reads

A running workflow needs the records behind its job: what to align against,
what to subtract, where its reads are. Six endpoints serve them, each at
Python's own resource path with no prefix.

| Route | Data function | Shape |
| --- | --- | --- |
| `GET /samples/{id}` | `getSample` | `WorkflowSample` |
| `GET /subtractions/{id}` | `getSubtraction` | `WorkflowSubtraction` |
| `GET /indexes/{id}` | `getIndex` | `WorkflowIndex` |
| `GET /analyses/{id}` | `getAnalysis` | `WorkflowAnalysis` |
| `GET /refs/{id}` | `getReference` | `WorkflowReference` |
| `GET /settings` | `getSettings` | `WorkflowSettings` |

Every one calls the data function `apps/web` already calls. None adds a
query for a table one of those reads, and none keeps a private copy of one.
A missing row is a 404 through the handler's own mapping of the domain's
`NotFoundError`, never a 500, and a path segment that is not a positive
integer is a 404 before the database is touched. That same `parseRowId` is
what keeps `GET /jobs/counts` — still Python's, and KEDA's scale trigger —
from resolving here as a job read: `counts` is not a positive integer, so it
404s rather than matching `/jobs/{jobId}`.

The path for a reference is `/refs/{id}`, matching Python, not the
spelled-out `/references` the package name suggests.

### Records only, never bytes

Under Python a workflow pulled its files through the jobs API. Workflows now
hold their own credentials for the shared bucket and read it directly, so
these endpoints owe them *records only*. No handler streams a payload, and
no handler may call `storage.write` — a read that lazily built
`index.sqlite` or an HMM annotation blob would put artifact generation on a
path that is supposed to be a lookup. Python's `create_index` task writes a
build's artifacts eagerly; this side reports the rows that exist and
generates nothing, so an unfinished build answers with an empty file list
rather than producing one.

`ReadHandlerDeps` is `{ db }` and nothing else. A read cannot reach
`storage` because it is never handed one.

### Every file reference carries its recorded key

**Keys are recorded, not derived.** Each file row holds its object's
complete key in a `storage_key` column, and these responses pass it through
verbatim. Nothing reconstructs one: a migrated row keeps whatever prefix its
object was written under, so keys in the bucket are heterogeneous by design
and no pattern regenerates them. A response that omitted the key would leave
the workflow able to see that a file exists and reach none of it.

The key is nullable wherever its column is — `sample_reads` and
`subtraction_files` both predate keys being recorded — and `index_files` is
`NOT NULL`. A workflow handed a null has nothing to fetch and must fail
rather than guess.

**This is not a privilege widening.** A workflow pod already holds unscoped
credentials for the bucket, so the key is a locator, not a capability. The
asymmetry lives on the write side instead: a manifest a workflow *sends* is
checked against the resource's own prefix before its key is recorded,
because a caller-supplied key there would let a job-authenticated caller
point a row at an arbitrary object.

### camelCase at the handler boundary, and narrower than the SPA's shapes

The data functions are not consistent in case — `hmm/data.ts`'s
`HmmInstalled` stays snake_case to mirror the GitHub releases API it wraps,
while `samples/data.ts` returns camelCase (`libraryType`) — and `apps/web`'s
client feature modules read those same shapes. So the mapping to camelCase
happens **in the handler**, and no field is renamed inside a data function.
Renaming one there would break the web app silently, days later, in a
different app.

The `Workflow*` shapes are also deliberately narrower than what the SPA
reads. They carry what a workflow branches on and drop the presentation
fields — download URLs, contributor lists, linked samples, rights lists —
which keeps `Date`-valued fields off a wire that only ever carries JSON
strings, and keeps this contract from having to stay parseable against
every field the UI grows.

Two consequences worth stating outright:

- **An analysis's `sample` is an object carrying an id, not a bare id.**
  Python's runtime falls back to reading it when a job's `args` carry no
  `sample_id`, so flattening it breaks every analysis whose job was created
  without one.
- **A sample's `paired` is derived from its reads**, not stored, and is what
  a workflow branches on to decide whether it is running one file or two.

### Reading an analysis does not format it

`getAnalysis` reads metadata and file rows only. The expensive half —
reading the TOASTed `results` column and patching every OTU back to the
version the analysis saw — is `getAnalysisResults`, a separate function this
path never calls. A workflow needs none of it, and these responses carry no
results at all.

### The settings read is a write

`GET /settings` has no 404: the row is a singleton, and `getSettings` seeds
`DEFAULT_SETTINGS` when it is absent, mirroring Python's
`SettingsData.ensure()`. That makes it the one endpoint here where a
job-authenticated GET can insert a row. It is deliberate — the alternative
is failing a workflow because nothing had written the row yet — but it is
worth knowing rather than discovering.

## Metrics

`GET /metrics` serves the Prometheus text exposition from this process's
**own registry**, built by `createMetrics`. It is a separate registry in a
separate process from the web app's; the series names deliberately match so
one dashboard covers both, and the two are told apart by the scrape's target
labels and by `application_name`, not by renaming the metrics. See
[docs/metrics.md](../../docs/metrics.md) for the handful of things only
visible by comparing this implementation against the web app's.

Prometheus needs a **second scrape job** for this service, and an
authenticated one — the endpoint requires a bearer token.

### The token

`VT_METRICS_TOKEN` gates it:

- **Unset or empty** — `404`. Metrics are off until a deployment opts in, so
  upgrading never starts exposing internals by surprise.
- **Set** — the request must carry `Authorization: Bearer <token>`.
  Anything else gets `401` and a `WWW-Authenticate: Bearer` header.

The service being unreachable from the internet does not make the token
redundant: everything inside the cluster can reach a ClusterIP, and the
endpoint shares a socket with the API itself.

The comparison is `isBearerTokenValid` from `@virtool/contracts/bearer`,
which is constant-time. It is shared with `apps/web` rather than copied,
because two copies of a constant-time comparison are two chances to quietly
regress one of them into `===`.

### No label may be unbounded

The request middleware labels each observation with the route's
**registered path pattern**, via `routePath(c, -1)` from `hono/route` —
`/jobs/:jobId`, never `/jobs/1234`. The label is then bounded by the number
of routes rather than by the number of jobs. A request matching nothing
falls to the middleware's own `/*`, which is bounded too.

The status label is gated on `c.finalized`, not on `c.error`. Hono's
`c.res` is a lazy getter that mints an empty 200 when nothing has set a
response, so reading it unconditionally counts a request that crashed as one
that succeeded; `c.finalized` is what says a response was actually set.

That is the whole gate, because `app.onError` now stands behind a thrown
`Error`: Hono's `compose` catches it, calls the handler, and finalizes its
500 before the middleware's `next()` resolves. Such a request is labelled
`status="500"` — the status the caller actually got — and the crash is
reported through the pino line and the Sentry event instead.

What is left for `status="error"` is a request that produced no response at
all. A **non-`Error` throw** is the one that gets there: `compose` rethrows
it without setting `c.error` and without reaching `onError`, whose guard is
`err instanceof Error`. The sentinel is bounded, and it keeps the counter's
total honest.

### Pool occupancy

`readConnectionCounts` (`@virtool/data/metrics/data`) filters
`pg_stat_activity` on the `applicationName` that `createDb` set. This
process passes `"jobs-api"` as `createDb`'s second argument, so it connects
as `virtool-ts-jobs-api@<hostname>` and counts **only its own backends** —
not the web app's, which share the database and, on a developer machine, the
hostname too.

The handler calls `readConnectionCountsBounded`, which applies the shared
`POOL_PROBE_TIMEOUT_MS` (two seconds). The probe is a query on the very pool
it measures, so a saturated pool queues it *client-side*, where nothing
rejects and no statement timeout applies; unbounded it would hang past the
scrape deadline and cost the whole response — process and request metrics
included — exactly when saturation is worth seeing. A failed or slow read
logs a warning and drops only the pool gauges.

The deadline lives in `@virtool/data` rather than beside each handler
because both services expose pool gauges and both need the same bound for
the same reason; a second copy is free to drift to a value that no longer
fits inside the scrape timeout.

### The job queue

Two series this service exposes and the web app does not:

```
virtool_jobs{workflow="pathoscope",state="pending"} 3
virtool_jobs_oldest_pending_age_seconds{workflow="pathoscope"} 412
```

Queue depth alone cannot tell a busy fleet from a stuck one, which is what
the second series is for.

They live here rather than on a workflow pod because a workflow pod is a
**one-shot Kubernetes Job**, and so a poor Prometheus target three ways
over. A batch pod may run for hours and vanish between scrapes — nothing
guarantees one exists when Prometheus comes round, and a short-lived one may
never be scraped at all, so its counters die with it. Labelling by pod name
is unbounded cardinality, which this repo forbids outright: every job mints
a pod name and the series set would never retire. cAdvisor already covers
per-pod CPU and memory, so the resource dimension was never the missing
one — the *queue* dimension was. The jobs API sees the whole fleet from one
place.

#### The labels are bounded, but only because this code makes them so

`jobs.workflow` is a plain `text` column with no enum constraint, so a typo
or a workflow a future Python release adds would otherwise mint a series
that never retires. `setJobQueue` folds anything outside
`JobWorkflow.options` (`@virtool/contracts`) into `other`. That is the one
definition of the workflow list; `NON_TERMINAL_JOB_STATES`
(`@virtool/data/jobs/data`) is the one definition of the state list, and is
derived from `JOB_STATES` rather than written out again.

Folded rows **add** their counts, because several workflows can land on
`other`. The ages do not add: the folded label takes the oldest of what
falls into it, which is what "the oldest pending job" means for every other
label too.

#### A drained queue must report zero

A gauge holds its last value forever. A workflow that drains would otherwise
report its final backlog indefinitely — the worst possible failure for an
alert on queue depth. So each refresh writes the full `JobWorkflow.options ×
{pending, running}` cross product as `0` first, then overwrites from the
rows that came back.

#### Only the non-terminal states, and only every ten seconds

`readJobCounts` covers `pending` and `running` and nothing else. Counting
every job ever run is a scan that grows forever, and the schema is
Python-owned — there are no Alembic revisions from this side, so there is no
index to add to rescue it. Terminal totals are also the wrong instrument: a
gauge over accumulated history is a counter wearing the wrong hat, and
failure rate belongs on a `_total` counter incremented when a job finishes.

`createJobQueueReader` memoizes the result for ten seconds through
`createMemoizedReader` (`@virtool/data/metrics/memoize`) — the same helper
`apps/tasks` builds its task-queue reader on, rather than each service
declaring its own TTL cache. Ten seconds is well under a typical 15–60s
scrape interval, so a scrape still sees a fresh queue. The bound matters in
the other direction: two Prometheus replicas, or a human curling the endpoint
in a loop, would otherwise multiply an unindexed scan across the very pool
this service claims jobs from. In-flight reads are shared as well as settled
ones, so two scrapes arriving together cost one query. A **rejection is not
cached** — the read is bounded already, and holding a failure for the full
TTL would keep these series dark for ten seconds past a blip that lasted one.

Both reads go out concurrently under one `readJobQueueBounded` deadline,
matched to the pool probe's two seconds for the same reason. A failure logs
a warning and leaves the pool gauges and the rest of the scrape alone — the
two pre-scrape reads are independent, so one failing does not take the
other's series with it.

#### A failed refresh drops these series, rather than letting them go stale

This is the one place the queue gauges are treated differently from the
pool gauges beside them, which do go stale at their last value.

A gauge holds its last value forever, and `registry.metrics()` renders
whatever is standing. So a queue depth left in place after a failed read is
re-served on **every** scrape of the outage, and Prometheus records each one
as a fresh sample — a flat line hiding a backlog that grew, or an alert held
open for a queue that has since drained. `clearJobQueue` resets both gauges
instead, so the series go absent and `absent()` can alert on the gap.

Absent rather than zero: zero asserts an empty queue, which is a different
claim from not knowing.

A pool occupancy is a property of this process and its last reading is
still roughly true while the probe fails. A queue depth is only meaningful
as of a moment, so the same treatment would be a lie.

#### The age is computed in Postgres, pinned to UTC

`created_at` is a naive `timestamp`. `readOldestPendingJobAges` subtracts it
as `now() - (min(created_at) at time zone 'UTC')`, so the age does not
depend on the session's time zone or the pod's — and UTC is what both
writers store, Python and Drizzle alike. Left to the session default, the
reported age would be wrong by the offset.

## Sentry

Reports to the **same project** as `apps/web`, which is what makes one
search across the whole backend possible. Two options from
`getCommonOptions(service)` keep the two apart:

- `initialScope.tags.service` — `jobs-api`, so an issue list, an alert rule
  or a dashboard can narrow to one service.
- `dist` — also `jobs-api`. Every image in this repo shares the release
  version, so without it the two services' source maps collide under one
  release and a stack trace resolves against whichever uploaded last.

The DSN is passed to `initSentry` explicitly rather than read from the
environment by the SDK helper. `readDsn` goes straight to `process.env` and
would skip the `<KEY>_FILE` resolution that `config.ts` has already done. No
DSN means no `init`, so dev and unconfigured deploys are untouched.

The same DSN decides the logger. `createAppLogger(config.sentryDsn)`
(`src/logger.ts`) attaches the pino destination from `@virtool/sentry/log`
when one is present, so `info`-and-above records reach Sentry's structured
logging API as well as stdout; the stream takes `Sentry.logger` as an
argument, which is what lets `apps/web`, `apps/tasks` and this service share
one implementation across two different SDKs. `src/index.ts` builds the
logger *before* calling `initSentry`, because everything below that line
logs — so the two lines `initSentry` itself writes are the only ones that
predate `init` and go to stdout alone.

**The process must be started with `node --import @sentry/node/preload`**,
as the Dockerfile `CMD` and the `start` script both do. Because the DSN
comes from file-backed config, `Sentry.init` cannot run until config has
been read — by which point ESM has already evaluated every static import,
including `@hono/node-server` and `postgres`. The preload hook installs the
SDK's module hooks ahead of all of them, which is what makes that late init
safe. Drop the flag and the service still reports errors while recording no
HTTP or database spans, with nothing in the logs to say so.

**A thrown handler reaches Sentry only through `app.onError`.** Hono catches
inside its own `compose`, so a bug in a route never becomes an
`uncaughtException` and the SDK's global handlers never see it — `init`
alone leaves the service reporting nothing at all. `createApp` registers the
handler, which logs the failure with the bounded `routePath(c, -1)`, calls
the optional `captureException` dep and answers `jsonError(500, "Internal
server error")` so the body shape matches every other refusal here. The
hook is **injected**, and `src/index.ts` is the only place
`Sentry.captureException` is named: `app.ts` then carries no dependency on
the SDK, its graph stays out of the test path, and "did we report it?" is
assertable with a `vi.fn()`.

There is **no `beforeSend` filter**, and that asymmetry with `apps/web` is
deliberate. The web app needs one because a server function signals an
expected 4xx by *throwing* `ClientError`, which would otherwise be reported
as a false incident. This service has no such mechanism: a Hono handler
returns a 4xx response rather than throwing, so nothing routine reaches
Sentry to be filtered. Add a filter only if a route starts throwing for an
expected outcome — and prefer not to.

The web app's filter also drops the `Error: aborted` a closed client socket
raises, and that half does not carry over either. It reports what
`app.onError` is handed, and a socket closing under an in-flight request
never reaches Hono's `compose` to become one. Should such an event ever show
up here, port the *paired* `ECONNRESET`-and-`aborted` match rather than
filtering the code, which this service sees from Postgres and object
storage as a genuine failure.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VT_POSTGRES_URL` | *required* | Connection string |
| `VT_POSTGRES_POOL_MAX` | `10` | postgres-js pool size |
| `VT_JOBS_API_HOST` | `0.0.0.0` | Listen address |
| `VT_JOBS_API_PORT` | `9950` | Listen port, matching Python's jobs API |
| `VT_JOBS_API_SHUTDOWN_TIMEOUT` | `30` | Seconds the shutdown sequence may take |
| `VT_METRICS_TOKEN` | unset | Bearer token for `/metrics`; unset means `404` |
| `VT_SENTRY_DSN` | unset | Unset disables Sentry |
| `VT_STORAGE_BACKEND` | *required* | `s3` or `azure` |
| `VT_STORAGE_S3_BUCKET` | *required for `s3`* | Bucket name |
| `VT_STORAGE_S3_REGION` | unset | Region |
| `VT_STORAGE_S3_ENDPOINT` | unset | Left unset for real AWS |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | unset | With the secret, or neither |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | unset | With the id, or neither |
| `VT_STORAGE_AZURE_ACCOUNT` | *required for `azure`* | Storage account |
| `VT_STORAGE_AZURE_CONTAINER` | *required for `azure`* | Container name |
| `VT_STORAGE_AZURE_ACCESS_KEY` | unset | Unset uses the pod's identity |
| `VT_STORAGE_AZURE_ENDPOINT` | unset | Left unset for real Azure |

The storage variables are the **same bucket** `apps/web` and Python use, and
the same variable names. `@virtool/storage` owns the config shape but reads
no environment itself, so each host application resolves it — this service
with a hand-rolled parser in `config.ts` rather than the zod schema
`apps/web` uses, because it deliberately carries no zod. The two only have
to agree on the variable names, which are the deployment's contract either
way. The S3 credential pair is **both or neither**: one alone is a
half-configured deployment that would otherwise fall back to instance
credentials and fail at the first request instead of at startup.

Every one also accepts a `<KEY>_FILE` variant naming a file to read the
value from, so a secret reaches a pod through the secrets-store CSI driver's
file mount rather than a Kubernetes `Secret`. The file **wins** over a plain
variable of the same name: a rollout moving to the mount can still carry the
stale variable from the `Secret` it replaces, and erroring on the overlap
would crashloop the very rollout that fixes it. An unreadable path throws at
startup; an empty file is an unset value.

That resolution is `resolveFileBacked` from `@virtool/contracts/env`, shared
with `apps/web` rather than copied so the precedence rule cannot drift
between the two services. It walks a list of keys the caller names —
`KEYS` in `config.ts` — so a key left off that list silently loses its file
variant. Add a key to both places.

Both helpers this service takes from `@virtool/contracts` sit behind their
own subpath exports (`/env`, `/bearer`) and are excluded from the package
barrel, because they use `node:fs` and `node:crypto` and most of
`@virtool/contracts` is imported by React components. The package
typechecks as two projects for the same reason: `tsconfig.json` covers the
browser-safe modules with no Node types at all, and `tsconfig.node.json`
covers just those two.

## The image

`ghcr.io/virtool/jobs-api`, built from the repo-root `Dockerfile`'s
`jobs-api` target and pushed by the release pipeline alongside the web
image.

The runtime base is **`node:24-bookworm-slim`**, as every stage in that file
is. This service copies nothing from `ghcr.io/virtool/tools` and needs no
bioinformatics binaries.

The app bundles to a single `dist/index.mjs` with tsdown, every
`@virtool/*` inlined from TypeScript source. `postgres` and `pino` stay
external and are materialised into the image by `pnpm deploy`; they are
listed verbatim as strings in `tsdown.config.ts`'s `neverBundle`, which is
also how knip sees them as used. `hono`, `@hono/node-server`,
`@sentry/node` and `prom-client` are externalised by default and are
imported directly by this app's source, so knip finds them without help.

`@virtool/storage`'s S3 and Azure SDKs ride along inlined, like every other
`@virtool/*` dependency.

## Deployment

The Kubernetes manifests live in a **different repository** — this one
carries no `k8s/`, chart or kustomization. What that repository needs for
this service:

- A Deployment running the `ghcr.io/virtool/jobs-api` image, with the
  liveness and readiness probes pointed at `/health/live` and
  `/health/ready`.
- A **ClusterIP** Service on 9950 and **no Ingress**. The absence of the
  ingress rule is the security boundary this whole service is built around.
- The `virtool` ServiceAccount, which carries the object-storage access
  cache registration uses to verify what a workflow wrote, and which the
  finalize endpoints will need for the same reason.
- A second, **authenticated** Prometheus scrape job carrying the bearer
  token, since the web app's scrape job cannot cover an endpoint on a
  different service with a different credential.

## What is not here yet

This service serves health, metrics, the job lifecycle, the two cache
endpoints, the three finalize routes and the six metadata reads — the whole
of the surface `packages/contracts/src/jobsApi.ts` describes, plus the job
element shapes it shares with the web app from `packages/contracts/src/jobs.ts`.

What stays Python's: cancelling a job, deleting one, the counts endpoint, and
the five-minute stalled-job sweep that fails a job whose last ping is too
old. Nothing here writes `cancelled` or `failed`, which is why there is no
failure route for a runner to call.

The reads cover the resources the four ported workflows name. Sample
artifacts are not among them: `sample_artifacts` is touched only by
`deleteSample`'s cleanup today, and no read path returns one. Add the read
when a workflow needs it, alongside the key column that row already
carries.

## Documentation

[docs/apps.md](../../docs/apps.md) covers the bundling and `pnpm deploy`
pipeline every non-Vite app shares, and [docs/images.md](../../docs/images.md)
the image pipeline.
