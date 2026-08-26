# @virtool/data

The server-only Postgres data layer: the Drizzle schema mirror, database pool,
test fixtures, and domain queries used by Virtool services.

## Type ownership

Infer database row and insert types from the Drizzle schema instead of copying
them into feature `types.ts` files. Re-export inferred types from the feature's
`data.ts` when its functions and other server modules share them. Keep function
option/value types, data-layer errors, and row-to-contract mappers in this
package; wire shapes shared with clients belong in `@virtool/contracts`.

Apply this convention as features are changed rather than bulk-converting
legacy `types.ts` files.

## Object storage

Virtool stores uploads, sample reads, analysis results, indexes, subtraction
files, HMM profiles, and caches in object storage. The implementation lives in
the server-only `@virtool/storage` package.

### Interface

Callers use `StorageBackend` and stream bytes rather than working with paths,
file handles, or presigned URLs:

```ts
type StorageBackend = {
	read(key: string): AsyncIterable<Uint8Array>;
	write(key: string, data: AsyncIterable<Uint8Array>): Promise<number>;
	delete(key: string): Promise<void>;
	list(prefix: string): AsyncIterable<StorageObjectInfo>;
	size(key: string): Promise<number>;
};
```

Keys are `/`-delimited and have no leading slash. `write` creates or
overwrites an object and returns the byte count; `delete` is idempotent.
Missing objects cause `read` and `size` to throw `StorageKeyNotFoundError`.
Other failures throw `StorageError`. Both errors come from
`@virtool/storage/errors` and do not depend on the data layer's `AppError`.

`StorageObjectInfo` contains `key`, `size`, and `lastModified`. Do not compare
`lastModified` across backends or depend on it for ordering because its source
differs between real buckets and `MemoryStorage`.

### Cleanup

Pass storage into data functions that remove stored objects. The argument
order is database, storage, logger, then domain arguments.

`deleteKeys(storage, keys)` attempts every deletion and never throws. It
returns `{ key, error }` pairs for failures; callers must log every returned
failure so orphaned objects remain observable. Collect recorded keys before
deleting their rows, including child keys removed by database cascades.

There is no prefix-based cleanup. Objects that were written without a key
being recorded remain for a future orphan sweep.

A chunked upload reserves an `uploads` row up front with `createPendingUpload`
(`ready: false`, invisible to every list) and records the key its bytes will
land at. The client writes the bytes straight to storage and calls
`finalizePendingUpload`, which reads the real size from storage — a missing
object means the commit never happened — and flips the row ready. `cancelPendingUpload`
drops a reservation the client abandons; `reapStalePendingUploads` sweeps any it
never cancelled, alongside the reserved-upload sweep.

### Keys

Storage keys are recorded, never reconstructed. Every read path uses the full
key stored in the corresponding row:

| Table | Column | Nullable |
| --- | --- | --- |
| `sample_reads` | `storage_key` | No |
| `index_files` | `storage_key` | No |
| `subtraction_files` | `storage_key` | Yes |
| `analysis_files` | `storage_key` | Yes |
| `uploads` | `storage_key` | Yes |
| `indexes` | `otus_json_storage_key` | Yes |

Nullable columns mirror nullable legacy sources rather than inventing keys
for objects that cannot be retrieved. The index OTU JSON key is stored on the
index because the on-demand artifact should not appear in its file listing.

Mint new keys with `@virtool/storage/keys`. UUID leaves are written in hex and
therefore contain no hyphens, matching the keys already in the bucket.

| Minter | Shape |
| --- | --- |
| `mintStorageKey(domain, parentId)` | `{domain}/{parentId}/{uuid}` |
| `mintRootStorageKey(domain)` | `{domain}/{uuid}` |
| `cacheKey(uuid)` | `caches/v1/{uuid}` |
| `HMM_PROFILES_KEY` | `hmm/profiles.hmm` |
| `HMM_ANNOTATIONS_KEY` | `hmm/annotations.json.gz` |

The parent segment groups objects for inspection but has no read-time
meaning. Uploads use `mintRootStorageKey`, allowing their object to be written
before the database row is created without holding a transaction open.
Migrated keys may contain Mongo slugs or integer IDs while newer keys contain
UUIDs; heterogeneous keys are intentional. Cache keys are also persisted and
must be read from their rows.

Workflow output keys cross the jobs API boundary because the workflow wrote
the object and knows its location. Record the supplied key verbatim after
validating that it is beneath `{domain}/{parentId}/`, has no leading slash,
and contains neither empty nor `..` segments. `POST /caches` is the exception:
it accepts a bare UUID and constructs `cacheKey(uuid)` server-side.

### Configuration

The web server parses storage configuration in `src/server/config.ts`.
`VT_STORAGE_BACKEND` is required and must be `s3` or `azure`; there is no
filesystem backend.

| Variable | Backend | Requirement |
| --- | --- | --- |
| `VT_STORAGE_BACKEND` | Both | Required |
| `VT_STORAGE_S3_BUCKET` | S3 | Required |
| `VT_STORAGE_S3_REGION` | S3 | Optional |
| `VT_STORAGE_S3_ENDPOINT` | S3 | Optional; omit for AWS |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | S3 | Optional as a credential pair |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | S3 | Optional as a credential pair |
| `VT_STORAGE_AZURE_ACCOUNT` | Azure | Required |
| `VT_STORAGE_AZURE_CONTAINER` | Azure | Required |
| `VT_STORAGE_AZURE_ACCESS_KEY` | Azure | Optional; managed identity if unset |
| `VT_STORAGE_AZURE_ENDPOINT` | Azure | Optional |

Every variable supports a `_FILE` variant. File values are trimmed, take
precedence over plain environment values, and fail startup when unreadable.
An empty value is treated as unset. S3 access and secret keys must be supplied
together after file-backed values are resolved; supplying neither uses the AWS
credential chain.

The composition root constructs one backend and passes it into data functions.
The storage package constructs nothing at import time. Use
`createStorageBackend` when another service needs its own configured instance.

Client code must access named `import.meta.env` properties and must never read
the environment object as a whole. Vite exposes the `VT_` prefix, so reading
the whole object could include storage credentials in the browser bundle.

### Backend behavior

For custom S3 endpoints, the backend enables path-style addressing; AWS uses
virtual-hosted addressing. Multipart parts use S3's 5 MiB minimum rather than
the smaller streaming chunk size. Response checksum validation is disabled to
support Garage's multipart checksum representation, while uploads continue to
send checksums.

S3 and compatible implementations report missing objects inconsistently, so
the backend normalizes a 404 from `GetObject` or `HeadObject` to
`StorageKeyNotFoundError`. Azure similarly normalizes `BlobNotFound` and 404.
Azure upload chunks are wrapped in zero-copy `Buffer` views because its SDK
expects `Buffer.copy`.

### Storage testing

Use `MemoryStorage` for data and service unit tests. Streaming, draining, and
listing fixtures are exported from `@virtool/storage/test/fixtures`.

The storage package's integration Vitest project runs the shared backend suite
against Garage and Azurite. Garage setup applies a single-node layout and
credentials through its admin API and waits on a log line because the image is
distroless. Containers are reused; tests isolate and purge their own
`test/{worker}/{testName}/` prefixes. Run storage server tests in a Node
environment so typed arrays come from the same JavaScript realm.

## Schema ownership

This package owns the Postgres schema. `src/db/schema/` is the source of truth;
migrations are generated from it with `db:generate` and applied with
`db:migrate`.

`drizzle/0000_baseline.sql` describes the schema as it stood when ownership
moved here. Production was stamped as already migrated rather than having that
baseline applied to it, so it must never be run against an existing database.

Many tables keep legacy shapes — `legacy_` prefixes, dead columns held for
snapshot fidelity, promoted-from-JSONB projections. Serve them as they are
rather than renormalizing them; the schema files say per-table what is dead and
what is load-bearing.

Keep `drizzle-orm` and `drizzle-kit` on compatible versions. Check both release
notes when updating either package because their schema-generation internals
change together.

## Outbound requests

Third-party requests use `USER_AGENT` from `@virtool/contracts/userAgent`,
which is the product name `virtool` and has no version. NCBI limits or blocks
requests that do not give a name. GitHub refuses requests that have no
`User-Agent` header.

This repository has no shared HTTP client. Each caller sets its own timeout.
The shared constant keeps the name the same everywhere, and no module builds a
client at import time.

### NCBI

This package speaks to two NCBI services, and they are not the same API.

`src/blast/ncbi.ts` is the BLAST URL API client. It is a separate CGI endpoint
that answers with HTML, plain text, and zip archives, so it stays here.

Nucleotide records and taxonomy come from `@virtool/ncbi`, which speaks to
E-utilities. Do not add a second E-utilities client to this package.

## Task queue

`src/tasks/data.ts` owns persistence for the Postgres task queue shared by task
producers and `apps/internal`'s `run` subcommand. Task names live in
`@virtool/contracts`:

- `PeriodicTaskName` is the set scheduled by the task service.
- `OnDemandTaskName` is the set accepted by `createTask()`.
- `TaskName` is the complete set the task service runs.

Create on-demand tasks through `createTask()`. When a domain row points at a
task, create both and attach them in the same transaction so neither can be
published without the other. The row itself is the enqueue signal; the runner
polls Postgres, so producers send no additional notification.

The data layer also owns claiming, lease renewal, fencing, progress, completion,
failure, release, and queue metrics reads. Every mutation that changes a task's
visible state publishes the corresponding `tasks` event. The execution and
shutdown contracts are documented in
[`apps/internal/README.md`](../../apps/internal/README.md).

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project owns the shared container definition in `src/db/test/globalSetup.ts`;
the web server project and `@virtool/internal` import that
setup rather than defining another container. The project has its own CI job
and is excluded from `Packages / Test`. Place tests beside their source as
`*.test.ts`.

Call `createTestDatabase()` from `@virtool/data/db/test/fixtures` once per test
file and drop it in `afterAll`. It creates an isolated database, applies the
schema derived from the Drizzle mirror, and installs the `client_events`
emitter on its connection. If a test mocks `@virtool/data/events/emit`, mock
both `emit` and `createEmitter` so fixture setup can still install the emitter.

The shared container uses `withReuse()` and deliberately has no teardown, so
local suites reuse it. Remove it with `docker rm -f` when it is no longer
wanted; separate CI jobs still start separate containers.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/data test` | Run tests against Postgres. |
| `pnpm --filter @virtool/data test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/data typecheck` | Type-check the package. |

Storage-specific commands are documented in
[`@virtool/storage`](../storage/README.md#commands).
