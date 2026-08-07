# The jobs API

`apps/jobs-api` is the service workflow runners call to claim, run and
finish jobs. It is a plain Node process serving HTTP on port 9950,
deployed as its own Deployment behind a ClusterIP service with **no
ingress rule** — nothing outside the cluster can reach it.

It is called "the jobs API" everywhere: the directory, the package
(`@virtool/jobs-api`), the image (`ghcr.io/virtool/jobs-api`), the
Kubernetes service, the Sentry `service` tag, the pino logger `name`,
and the `application_name` it connects to Postgres under. "Control
plane" describes its role; it is not a second name for it. Python and
the workflow runtime already call it the jobs API, and a service with
two names across two repositories is a service nobody can grep for.

## Why it is a separate service

It mirrors the topology Python already has — `virtool/jobs/main.py`, a
separate aiohttp app served as `api-jobs-service` on 9950 — and the port
matches so the two can be swapped behind the same ClusterIP.

Two things follow from the split that do not follow from a shared
process:

- **A bug in the job-key guard is not remotely exploitable.** The
  runner-facing surface is not reachable from the internet at all, so a
  mistake in the credential check is a cluster-internal problem rather
  than a public one.
- **Workflow traffic and page-load traffic get separate pools and scale
  independently.** A burst of runners claiming jobs cannot exhaust the
  connection pool the SPA's page loads depend on, and neither side's
  replica count is hostage to the other's load.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Entry point: config, Sentry, pool, server, graceful shutdown |
| `src/app.ts` | `createApp` — the Hono app, its middleware and its routes |
| `src/config.ts` | Environment parsing, including every `<KEY>_FILE` variant |
| `src/instrument.ts` | Sentry initialisation and the `SERVICE` constant |
| `src/logger.ts` | The pino logger singleton |
| `src/auth/verify.ts` | `verifyJobRequest` — the job credential check |
| `src/auth/guard.ts` | `requireJobRequest` — the guard every handler starts with |
| `src/auth/test/fixtures.ts` | `seedJob` — a job row and the plaintext key for it |
| `src/caches/handlers.ts` | Cache lookup and registration |
| `src/metrics/registry.ts` | `createMetrics` — this process's Prometheus registry |
| `src/metrics/jobs.ts` | `createJobQueueReader` — the memoized job-queue read |
| `src/metrics/handler.ts` | Token check, pre-scrape reads, response |
| `src/__tests__/authorization.test.ts` | The route-enumerating authorization floor |

Nothing is constructed at import time. `createApp` and `createMetrics`
are factories taking their dependencies as arguments, the same rule
`@virtool/data` and `@virtool/storage` follow — which is what lets the
authorization test build a whole app over fakes without opening a pool.

## Hono, and why

The handlers this service grows are ported from raw-route handlers
already written against Web `Request`/`Response`, so they move across
verbatim. Hono is a thin router over exactly those types; Express and
Fastify would each have meant rewriting every handler against a
framework-specific request object for nothing.

`@hono/node-server` adapts the app to `node:http`. `serve()` returns a
Node server, which is what the `SIGTERM` handler closes.

## It must never import from `apps/web`

In either direction. A `biome.json` override over `apps/*/src/**`
(excluding `apps/web/src/**`) bans every feature alias, `@server/**`,
the `@/*` catch-all, and relative reaches into `apps/web`.

This service is the likeliest offender, because it does work
`apps/web/src/server` also does — so copying an import from there is an
easy mistake. Shared code goes *down* into a package instead:
`@virtool/data` for persistence and domain functions, `@virtool/storage`
for object storage, `@virtool/contracts` for wire shapes and the two
server helpers below, `@virtool/logger` and `@virtool/sentry` for
observability.

## The authorization floor

`src/__tests__/authorization.test.ts` enumerates `app.routes` and
requires **every route** either to refuse an unauthenticated request —
401, 403, or 404 — or to be named in `PUBLIC_ROUTES` in `app.ts`, with a
comment saying why.

A route added without a floor therefore fails the build, by name, rather
than shipping open. That test landed with the skeleton and before any
endpoint, deliberately: a guard added after the endpoints it guards is a
guard written to match whatever those endpoints already do.

`PUBLIC_ROUTES` holds exactly two entries, both Kubernetes probes:

- `/health/live`
- `/health/ready`

The kubelet presents no credential, and a readiness probe that could
fail closed on an auth problem would take the pod out of service for the
wrong reason. Neither reveals anything beyond whether Postgres answers.

`/metrics` is deliberately **not** in that list. It enforces its own
bearer token and is expected to refuse like everything else.

The test also asserts the reverse: every `PUBLIC_ROUTES` entry names a
route that actually exists. A stale exception is as much a bug as a
missing one — it reads as a deliberate decision about a route that is no
longer there.

## The job credential

A workflow pod authenticates as the job it claimed, over HTTP Basic:

```
Authorization: Basic base64(job-{jobId}:{key})
```

`verifyJobRequest` (`src/auth/verify.ts`) resolves that to a
`JobPrincipal` — `{ jobId }`, and nothing else. There is deliberately no
`userId` and no permission set on it. A pod acts as its job, not as the
user who created the job, and every rule this service enforces is a rule
about which job may touch which row; carrying the owner would invite a
handler to authorize against them instead.

The sequence, in order:

1. Read the `Authorization` header. Missing is a failure.
2. Parse it as Basic. A non-Basic scheme, undecodable base64, a missing
   `:`, or an empty login is a failure.
3. Match the login against `/^job-(\d+)$/` — **anchored and
   case-sensitive**.
4. Screen the id: at least 1, and no larger than a Postgres `integer`.
5. Read `key` and `state` for that id, in **one** query.
6. Fail if `key` is null — that job was never claimed.
7. Compare `hashToken(key)` to the stored digest with `timingSafeEqual`,
   behind a length screen.
8. Fail if `state` is terminal.

**There is no cookie fallback, ever.** This service has no session
model, and nothing that reaches it holds a browser session.

`requireJobRequest` (`src/auth/guard.ts`) wraps it and is what a handler
calls. On failure it **returns** `401 Unauthorized` rather than throwing
— a thrown refusal would have to be caught somewhere, and that somewhere
also catches genuine bugs, so a handler crashing halfway through would
answer 401 and read as a credential problem to the runner and to Sentry
alike. The 401 carries **no `WWW-Authenticate` header**: that header
exists to make a browser prompt, and a runner's key is minted once, at
claim time, so there is nothing an interactive retry could supply.

Every failure returns an identical, opaque 401. Nothing distinguishes an
unknown job from a wrong key from a finished one — the most useful thing
a caller could otherwise learn is which job ids exist.

### Terminal state is the whole of key revocation

A key has no expiry, no revocation list and no rotation: `jobs.key` holds
one digest for the life of the row. Reaching `cancelled`, `failed` or
`succeeded` is the **only** thing that stops it authenticating, which is
why the state is re-read on every request rather than trusted at claim
time. A runner pod that outlives the job it claimed still holds a
syntactically valid credential, and that check is what stops it being
accepted.

### The two local copies

`hashToken` and `parseBasicAuthHeader` are reimplemented in
`src/auth/verify.ts` rather than shared, each with a comment naming its
counterpart, and each pinned by fixed-vector tests.

`parseBasicAuthHeader` has no choice: its counterpart is in
`apps/web/src/server/auth/verify.ts`, which this service must not reach
into. `hashToken`'s counterpart is `@virtool/data/auth/tokens`, and both
mirror Python's `hash_key` at `virtool/utils.py:98-99`. All three must
produce the same digest forever — Python writes the column this side
reads — so the test pins fixed digests rather than comparing the two
TypeScript copies, which would pass just as happily if both drifted away
from Python together.

The `seedJob` fixture hashes with **`@virtool/data`'s** `hashToken`,
deliberately. Seeding with the copy under test would make the verifier
agree with itself no matter what either did; going through the shared one
means a test that authenticates successfully has also shown the two agree.

### Differences from Python

`virtool/jobs/auth.py` is the counterpart middleware. Two deliberate
divergences, both stricter:

- The login is matched against an anchored pattern rather than
  `holder_id.split("-")`, which checks only the first part. `job-1-2`
  reaches Python's `int()` and raises; here it is simply not a login.
- The key comparison is timing-safe. Python's is a plain `!=`.

Python also answers 403 when the authenticated job id does not match a
`job_id` path parameter. That is a per-route rule, not a property of the
credential, so it belongs in the handlers rather than here — which is
what `JobPrincipal` carrying `jobId` is for.

### Tests need Postgres

`verify.test.ts` and `guard.test.ts` run against `createTestDatabase()`,
so `apps/jobs-api/vitest.config.ts` names
`@virtool/data/db/test/globalSetup` — the same module `@virtool/data`'s
project and `apps/web`'s `server` project name, so one `withReuse()` hash
covers all three and a local run of them boots a single container.

That is also why this workspace has its own `Test / Jobs API` CI job and
is excluded from `Test / Packages`: pulling a Postgres image does not
belong in the fast package loop.

## Health

| Route | Meaning |
| --- | --- |
| `GET /health/live` | The process is up. Always `200`, no I/O. |
| `GET /health/ready` | `200` when Postgres answers, `503` when it does not. |

Both fold `checkPostgres` through `summarizeReadiness` from
`@virtool/data/health/data` — the same pair `apps/web` uses, so the two
services' probes cannot drift. Neither requires the metrics token: a
probe that needed a credential would be one more thing to get wrong
during a rollout.

## Caches

Workflows reuse expensive derived artifacts — trimmed reads, mapping
indexes, collapsed references — through the `caches` table, which Python
owns at `virtool/caches/pg.py` and `@virtool/data` mirrors read-only.

| Route | Meaning |
| --- | --- |
| `GET /caches/{key}` | Resolve a logical key to its row. `404` on a miss. |
| `POST /caches` | Register a row for a blob the caller has already written. |

Both paths match Python's, with no prefix — a separate app has no SPA to
collide with. Each handler calls `requireJobRequest` itself; nothing
runs middleware on its behalf.

**Neither endpoint carries cache bytes.** Workflows have direct
object-storage access, so the writer puts its blob at `caches/v1/<uuid>`
and then registers the row, and the reader takes `storageKey` to the
bucket. Python streamed payloads through its jobs API; this does not.

**Lookup is not optional garnish.** A row's `storageKey` is a per-write
UUID and is not derivable from the cache key, so a workflow holding a
derived key cannot read the blob at all until this server resolves one
to the other. It is on the hot path of every workflow start, which is
why `getCache` refreshes `last_accessed_at` only when it is older than
five minutes — Python's `LAST_ACCESSED_REFRESH_INTERVAL`, and the same
threshold on both sides because both read the same rows. An
unconditional `UPDATE` would turn every read into a write.

### The wire carries a UUID, never a storage key

`POST /caches` takes `{ key, uuid, params }`, and the server composes
the storage key with `cacheKey(uuid)` from `@virtool/storage`. The uuid
is validated as 32 lowercase hex characters.

This is not stylistic. A caller-supplied `storageKey` would let a
job-authenticated caller register a cache row pointing at a sample,
index or subtraction object — and Python's LRU eviction deletes by
`storage_key`, so that is a route to having another domain's files
destroyed. Composing the key from a validated uuid makes it
unrepresentable.

The uuid must also be **fresh per write attempt**, never derived from
the cache key, so that the loser of a race can delete its own orphan
without touching the winner's object.

### Verify, then transact

`registerCache` calls `storage.size(cacheKey(uuid))` **before** any
database work, and stores the size it read. A caller declaring a blob it
never wrote gets `400` and leaves no row behind; a caller sending a size
is simply ignored — the field is not on the contract. No storage call
happens inside a transaction.

### Losing the race is success

Two workflows can legitimately derive the same cache key at once, and
both blobs hold the same bytes, so **"already existed" is a 2xx** — 201
when the call created the row, 200 when it did not, plus a `created`
flag in the body for logging.

The insert uses `onConflictDoNothing({ target: caches.key })`, targeting
the `cache_key` constraint **specifically**. A bare
`onConflictDoNothing()` would also swallow a `storage_key` collision,
which can only mean a reused uuid — a bug, and one that would leave two
logical caches sharing one object.

When the insert takes no row, the loser re-selects by `key` and returns
the **winner's** row, so it reads the blob that actually survived. It
then deletes its own orphan, after the write has committed, logging a
failure rather than throwing. That is necessary because an orphan has no
row, so Python's LRU eviction, which walks rows, will never reclaim it.

**The delete is guarded on the winner's `storage_key` differing from the
one this call composed.** A retry — a lost response, an ordinary client
retry — arrives with the *same* uuid, so it re-selects its own row and
the object it would delete is the live one that row names. Deleting
there leaves a row pointing at nothing: unreadable to every later
lookup, and unrepairable by eviction, which walks rows and would find
this one perfectly intact. The guard is what makes `POST /caches`
idempotent rather than merely conflict-tolerant.

This deliberately diverges from Python, which raises
`CacheAlreadyExistsError` on the same race. The divergence is the reason
the loser path is handled explicitly rather than left to an error
handler.

### Eviction stays in Python

No eviction, storage-budget accounting or scheduled cleanup lives here.
`CACHE_EVICTION_GRACE_PERIOD`, `select_eviction_candidates` and the
periodic task in `virtool/caches/` remain Python's. The only deletion
this service performs is the loser's own orphan.

## Finalize

A workflow writes its outputs to object storage itself and then makes
**one** call per resource, carrying that resource's finalize fields
alongside a manifest of what it wrote. Python needed roughly twenty
per-file upload endpoints for the same job.

| Route | Body | Rows written | Parent update |
| --- | --- | --- | --- |
| `PATCH /subtractions/{id}` | `FinalizeSubtractionRequest` | `subtraction_files` | `count`, `gc`, `ready` |
| `PATCH /samples/{id}` | `FinalizeSampleRequest` | `sample_reads` | `quality`, `ready` |
| `PATCH /analyses/{id}` | `FinalizeAnalysisRequest` | `analysis_files` | `results`, `ready`, `updated_at` |

`index_files` is **not** here. Index builds are still started by
`createIndex` and finished by Python's `create_index` task runner, which
writes the artifact and its file rows itself.

The manifest rides along with the finalize call rather than arriving as
a separate step, so a run cannot end with the parent flipped `ready` and
its file list missing. Each handler is an ordinary
`Request → Promise<Response>` in `apps/jobs-api/src/<feature>/handlers.ts`
that calls `requireJobRequest` first; the row work lives in
`@virtool/data`, typed `DbOrTx`, because it is the same data layer the
web app reads through.

### The wire carries a storage key, and the row records it verbatim

This is the opposite of what `POST /caches` does, and the difference is
deliberate.

The cache rule exists because a cache row's key is *derivable* — it is
`caches/v1/<uuid>` and nothing else — so composing it server-side costs
nothing and makes a cross-domain row unrepresentable. A finalize key is
not derivable: the workflow already wrote the bytes somewhere, and
composing a second key here would put a second opinion about where they
went next to the writer's, free to disagree. The size check would then
surface that disagreement as a confusing `400` rather than as the key
mismatch it is.

Nor is there a boundary to defend. The principal is a workflow pod
holding the **same unscoped `VT_STORAGE_*` credentials** as the web app
and Python — no per-job prefix, no scoped token — issued to the same pod
at the same time as its job key. A compromised pod deletes objects
directly; it has no reason to launder a deletion through a manifest.

What remains is a check against buggy key interpolation, and it is a
prefix check. Every key must sit under `{domain}/{parentId}/` for the
resource named in the route's **own path** — `subtractions/{id}/`,
`samples/{id}/`, `analyses/{id}/` — which is exactly what
`mintStorageKey(domain, parentId)` produces, so both sides stay on one
builder. Alongside it, structural checks reject an empty key, a leading
`/`, an empty segment and a `..` segment. `apps/jobs-api/src/manifest.ts`
holds all of it.

Filenames are checked too, but only as filenames: no `/`, no traversal
segment, and — for subtractions and samples — against the same
whitelists Python enforces, because Python's download endpoints address
those rows by `name`.

| Resource | Accepted names |
| --- | --- |
| Subtraction | `subtraction.fa.gz`, `subtraction.{1,2,3,4}.bt2`, `subtraction.rev.{1,2}.bt2` |
| Sample | `reads_1.fq.gz`, `reads_2.fq.gz` |
| Analysis | any plain filename — the workflow names its own outputs |

### The manifest declares neither a size nor a name on disk

`size` is not on the contract. Every row is written with the byte count
the route read back from `storage.size()`, which is what makes "a row
pointing at nothing" impossible, so a declared size would be a field
nothing stores and nothing checks.

`name_on_disk` is derived as well. A reads file repeats its `name`,
matching Python. An analysis file gets `{uuid}-{name}`, following the
`createUpload` precedent rather than Python's post-flush `{id}-{name}`,
which needs the row id and so a second write — the column is unique
across the whole table, so it cannot simply be the workflow's filename.
A subtraction file's `type` is likewise derived from the extension, as
Python's `check_subtraction_file_type` does; with the name whitelisted
there is nothing left to decide, and no way to record a `.bt2` shard as
the FASTA.

### Verify, then transact

Every `storage.size()` call for a manifest completes **before**
`db.transaction(...)` opens, and the transaction holds Postgres work
only. A manifest naming a blob that is not in the bucket answers `400`
having written no rows and made no parent update.

`subtraction/handlers.test.ts` asserts the ordering rather than assuming
it: `createTestDatabase({ onQuery })` and a `MemoryStorage` wrapper put
SQL statements and storage reads on one timeline, and the test requires
every `size()` to precede the `BEGIN`. Without that, a check that slipped
inside the transaction would hold a pool connection across a round trip
to the bucket, and a missing blob would abort a transaction that had
already written rows.

### 409, not idempotent

Each parent update is conditional — `WHERE id = ? AND ready = false`,
plus `AND deleted = false` for a subtraction — and its row count is
checked. A zero row count re-selects the row to tell the two cases apart:
gone or soft-deleted is `404`, already finalized is `409`. Python makes
the same split, and a second finalize must not be quietly accepted:
these calls write file rows, and accepting one twice writes the set
twice.

### Finalizing a sample destroys its input uploads

Matching Python. The `sample_uploads` rows are marked
`removed`/`removed_at` **inside** the transaction and their blobs deleted
**after** it commits, with `deleteKeys` failures logged rather than
failing a finalize that already happened.

Marking without deleting is the tempting middle ground and it is wrong.
`removed = true` already means "the bytes are gone" everywhere else —
`deleteUpload` marks the row and deletes the object in one call — so a
removed row still naming a live object is invisible to the UI *and* to
any orphan sweep, because the object is named by a row. Those bytes leak
permanently, at one full duplicate of every sample's input reads.
Deleting is safe because `reserveUploads` rejects an already-reserved
upload, so an upload belongs to exactly one sample and no other row can
name that blob. `reserved` is deliberately left alone; `removed` gates
every read path.

A read's source upload is **derived, not declared**:
`sample_uploads.index` is the position an upload held in the create
request, and the workflow writes them out in that order as `reads_1` and
`reads_2`, so the link is by position. There is no wire field with which
a runner could name another sample's upload.

### Subtractions reach the browser over SSE

`emit(...)` runs after each commit, never inside. Analyses emit a
`samples` update alongside their own, because a sample's workflow tags
are derived from its analyses.

Subtractions had no SSE domain at all before these routes existed, so
one was added: `subtractions` in `SseDomainSchema` **and** a
`frame("subtractions", NumberId)` in `SseMessageSchema`
(`packages/contracts/src/sse.ts`), plus the matching entry in
`reactQueryHandler`'s `domains` record. **No Python change was needed** —
Python publishes free-form domain strings onto `client_events` and has
been emitting `subtractions` all along; the client was dropping the
frames because its schema did not accept them.

## Metrics

`GET /metrics` serves the Prometheus text exposition from this process's
**own registry**, built by `createMetrics`. It is a separate registry in
a separate process from the web app's; the series names deliberately
match so one dashboard covers both, and the two are told apart by the
scrape's target labels and by `application_name`, not by renaming the
metrics.

Prometheus needs a **second scrape job** for this service, and an
authenticated one — the endpoint requires a bearer token.

### The token

`VT_METRICS_TOKEN` gates it:

- **Unset or empty** — `404`. Metrics are off until a deployment opts
  in, so upgrading never starts exposing internals by surprise.
- **Set** — the request must carry `Authorization: Bearer <token>`.
  Anything else gets `401` and a `WWW-Authenticate: Bearer` header.

The service being unreachable from the internet does not make the token
redundant: everything inside the cluster can reach a ClusterIP, and the
endpoint shares a socket with the API itself.

The comparison is `isBearerTokenValid` from `@virtool/contracts/bearer`,
which is constant-time. It is shared with `apps/web` rather than copied,
because two copies of a constant-time comparison are two chances to
quietly regress one of them into `===`.

### No label may be unbounded

The request middleware labels each observation with the route's
**registered path pattern**, via `routePath(c, -1)` from `hono/route` —
`/jobs/:jobId`, never `/jobs/1234`. The label is then bounded by the
number of routes rather than by the number of jobs. A request matching
nothing falls to the middleware's own `/*`, which is bounded too.

A handler that throws leaves no status behind, so those are counted as
`status="error"` — a bounded sentinel that keeps the counter's total
honest either way.

### Pool occupancy

`readConnectionCounts` (`@virtool/data/metrics/data`) filters
`pg_stat_activity` on the `applicationName` that `createDb` set. This
process passes `"jobs-api"` as `createDb`'s second argument, so it
connects as `virtool-ts-jobs-api@<hostname>` and counts **only its own
backends** — not the web app's, which share the database and, on a
developer machine, the hostname too.

The handler calls `readConnectionCountsBounded`, which applies the shared
`POOL_PROBE_TIMEOUT_MS` (two seconds). The probe is a query on the very
pool it measures, so a saturated pool queues it *client-side*, where
nothing rejects and no statement timeout applies; unbounded it would hang
past the scrape deadline and cost the whole response — process and
request metrics included — exactly when saturation is worth seeing. A
failed or slow read logs a warning and drops only the pool gauges.

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

Queue depth alone cannot tell a busy fleet from a stuck one, which is
what the second series is for.

They live here rather than on a workflow pod because a workflow pod is a
**one-shot Kubernetes Job**, and so a poor Prometheus target three ways
over. A batch pod may run for hours and vanish between scrapes — nothing
guarantees one exists when Prometheus comes round, and a short-lived one
may never be scraped at all, so its counters die with it. Labelling by
pod name is unbounded cardinality, which this repo forbids outright:
every job mints a pod name and the series set would never retire.
cAdvisor already covers per-pod CPU and memory, so the resource
dimension was never the missing one — the *queue* dimension was. The
jobs API sees the whole fleet from one place.

#### The labels are bounded, but only because this code makes them so

`jobs.workflow` is a plain `text` column with no enum constraint, so a
typo or a workflow a future Python release adds would otherwise mint a
series that never retires. `setJobQueue` folds anything outside
`JobWorkflow.options` (`@virtool/contracts`) into `other`. That is the
one definition of the workflow list; `NON_TERMINAL_JOB_STATES`
(`@virtool/data/jobs/data`) is the one definition of the state list, and
is derived from `JOB_STATES` rather than written out again.

Folded rows **add** their counts, because several workflows can land on
`other`. The ages do not add: the folded label takes the oldest of what
falls into it, which is what "the oldest pending job" means for every
other label too.

#### A drained queue must report zero

A gauge holds its last value forever. A workflow that drains would
otherwise report its final backlog indefinitely — the worst possible
failure for an alert on queue depth. So each refresh writes the full
`JobWorkflow.options × {pending, running}` cross product as `0` first,
then overwrites from the rows that came back.

#### Only the non-terminal states, and only every ten seconds

`readJobCounts` covers `pending` and `running` and nothing else.
Counting every job ever run is a scan that grows forever, and the schema
is Python-owned — there are no Alembic revisions from this side, so
there is no index to add to rescue it. Terminal totals are also the
wrong instrument: a gauge over accumulated history is a counter wearing
the wrong hat, and failure rate belongs on a `_total` counter
incremented when a job finishes.

`createJobQueueReader` memoizes the result for ten seconds — well under
a typical 15–60s scrape interval, so a scrape still sees a fresh queue.
The bound matters in the other direction: two Prometheus replicas, or a
human curling the endpoint in a loop, would otherwise multiply an
unindexed scan across the very pool this service claims jobs from.
In-flight reads are shared as well as settled ones, so two scrapes
arriving together cost one query. A **rejection is not cached** — the
read is bounded already, and holding a failure for the full TTL would
keep these series dark for ten seconds past a blip that lasted one.

Both reads go out concurrently under one `readJobQueueBounded` deadline,
matched to the pool probe's two seconds for the same reason. A failure
logs a warning and leaves the pool gauges and the rest of the scrape
alone — the two pre-scrape reads are independent, so one failing does
not take the other's series with it.

#### A failed refresh drops these series, rather than letting them go stale

This is the one place the queue gauges are treated differently from the
pool gauges beside them, which do go stale at their last value.

A gauge holds its last value forever, and `registry.metrics()` renders
whatever is standing. So a queue depth left in place after a failed read
is re-served on **every** scrape of the outage, and Prometheus records
each one as a fresh sample — a flat line hiding a backlog that grew, or
an alert held open for a queue that has since drained. `clearJobQueue`
resets both gauges instead, so the series go absent and `absent()` can
alert on the gap.

Absent rather than zero: zero asserts an empty queue, which is a
different claim from not knowing.

A pool occupancy is a property of this process and its last reading is
still roughly true while the probe fails. A queue depth is only
meaningful as of a moment, so the same treatment would be a lie.

#### The age is computed in Postgres, pinned to UTC

`created_at` is a naive `timestamp`. `readOldestPendingJobAges`
subtracts it as `now() - (min(created_at) at time zone 'UTC')`, so the
age does not depend on the session's time zone or the pod's — and UTC is
what both writers store, Python and Drizzle alike. Left to the session
default, the reported age would be wrong by the offset.

## Sentry

Reports to the **same project** as `apps/web`, which is what makes one
search across the whole backend possible. Two options from
`getCommonOptions(service)` keep the two apart:

- `initialScope.tags.service` — `jobs-api`, so an issue list, an alert
  rule or a dashboard can narrow to one service.
- `dist` — also `jobs-api`. Every image in this repo shares the release
  version, so without it the two services' source maps collide under one
  release and a stack trace resolves against whichever uploaded last.

The DSN is passed to `initSentry` explicitly rather than read from the
environment by the SDK helper. `readDsn` goes straight to `process.env`
and would skip the `<KEY>_FILE` resolution that `config.ts` has already
done. No DSN means no `init`, so dev and unconfigured deploys are
untouched.

**The process must be started with `node --import @sentry/node/preload`**,
as the Dockerfile `CMD` and the `start` script both do. Because the DSN
comes from file-backed config, `Sentry.init` cannot run until config has
been read — by which point ESM has already evaluated every static import,
including `@hono/node-server` and `postgres`. The preload hook installs
the SDK's module hooks ahead of all of them, which is what makes that late
init safe. Drop the flag and the service still reports errors while
recording no HTTP or database spans, with nothing in the logs to say so.

There is **no `beforeSend` filter**, and that asymmetry with `apps/web`
is deliberate. The web app needs one because a server function signals an
expected 4xx by *throwing* `ClientError`, which would otherwise be
reported as a false incident. This service has no such mechanism: a Hono
handler returns a 4xx response rather than throwing, so nothing routine
reaches Sentry to be filtered. Add a filter only if a route starts
throwing for an expected outcome — and prefer not to.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VT_POSTGRES_URL` | *required* | Connection string |
| `VT_POSTGRES_POOL_MAX` | `10` | postgres-js pool size |
| `VT_JOBS_API_HOST` | `0.0.0.0` | Listen address |
| `VT_JOBS_API_PORT` | `9950` | Listen port, matching Python's jobs API |
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

The storage variables are the **same bucket** `apps/web` and Python use,
and the same variable names. `@virtool/storage` owns the config shape but
reads no environment itself, so each host application resolves it — this
service with a hand-rolled parser in `config.ts` rather than the zod
schema `apps/web` uses, because it deliberately carries no zod. The two
only have to agree on the variable names, which are the deployment's
contract either way. The S3 credential pair is **both or neither**: one
alone is a half-configured deployment that would otherwise fall back to
instance credentials and fail at the first request instead of at startup.

Every one also accepts a `<KEY>_FILE` variant naming a file to read the
value from, so a secret reaches a pod through the secrets-store CSI
driver's file mount rather than a Kubernetes `Secret`. The file **wins**
over a plain variable of the same name: a rollout moving to the mount can
still carry the stale variable from the `Secret` it replaces, and erroring
on the overlap would crashloop the very rollout that fixes it. An
unreadable path throws at startup; an empty file is an unset value.

That resolution is `resolveFileBacked` from `@virtool/contracts/env`,
shared with `apps/web` rather than copied so the precedence rule cannot
drift between the two services. It walks a list of keys the caller
names — `KEYS` in `config.ts` — so a key left off that list silently
loses its file variant. Add a key to both places.

Both helpers this service takes from `@virtool/contracts` sit behind
their own subpath exports (`/env`, `/bearer`) and are excluded from the
package barrel, because they use `node:fs` and `node:crypto` and most of
`@virtool/contracts` is imported by React components. The package
typechecks as two projects for the same reason: `tsconfig.json` covers
the browser-safe modules with no Node types at all, and
`tsconfig.node.json` covers just those two.

## The image

`ghcr.io/virtool/jobs-api`, built from the repo-root `Dockerfile`'s
`jobs-api` target and pushed by the release pipeline alongside the web
image.

The runtime base is **`node:24-alpine`**. This service copies nothing
from `ghcr.io/virtool/tools` and needs no bioinformatics binaries, so it
does not pay the Debian base the workflow images pay to satisfy those
binaries. Do not move it to Debian for uniformity's sake.

The app bundles to a single `dist/index.mjs` with tsdown, every
`@virtool/*` inlined from TypeScript source. `postgres` and `pino` stay
external and are materialised into the image by `pnpm deploy`; they are
listed verbatim as strings in `tsdown.config.ts`'s `neverBundle`, which
is also how knip sees them as used. `hono`, `@hono/node-server`,
`@sentry/node` and `prom-client` are externalised by default and are
imported directly by this app's source, so knip finds them without help.

`@virtool/storage`'s S3 and Azure SDKs ride along inlined, like every
other `@virtool/*` dependency.

## Deployment

The Kubernetes manifests live in a **different repository** — this one
carries no `k8s/`, chart or kustomization. What that repository needs
for this service:

- A Deployment running the `ghcr.io/virtool/jobs-api` image, with the
  liveness and readiness probes pointed at `/health/live` and
  `/health/ready`.
- A **ClusterIP** Service on 9950 and **no Ingress**. The absence of the
  ingress rule is the security boundary this whole service is built
  around.
- The `virtool` ServiceAccount, which carries the object-storage access
  cache registration uses to verify what a workflow wrote, and which the
  finalize endpoints will need for the same reason.
- A second, **authenticated** Prometheus scrape job carrying the bearer
  token, since the web app's scrape job cannot cover an endpoint on a
  different service with a different credential.

## What is not here yet

This service serves health, metrics, the two cache endpoints and the
three finalize routes. The job lifecycle endpoints — claim, ping, step
start and finish — each land in their own issue, against the wire
contract already written in `packages/contracts/src/jobsApi.ts`.
