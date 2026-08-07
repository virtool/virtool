# Storage

Virtool keeps every file it owns — uploads, sample reads, analysis results,
index and subtraction files, HMM profiles, caches — in object storage. Python
and the TypeScript server read and write **the same bucket**, so this layer is
a port of Python's, not a design of its own. Where the two could drift, they
must not.

The layer lives in the `@virtool/storage` workspace package, so the jobs API
and the TypeScript workflow ports can reach it without pulling in the Vite app.
It is server-side only.

## The interface

`StorageBackend` has five methods and nothing else. No paths, no file handles,
no presigned URLs — callers stream bytes.

```ts
type StorageBackend = {
	read(key: string): AsyncIterable<Uint8Array>;
	write(key: string, data: AsyncIterable<Uint8Array>): Promise<number>;
	delete(key: string): Promise<void>;
	list(prefix: string): AsyncIterable<StorageObjectInfo>;
	size(key: string): Promise<number>;
};
```

- Keys are `/`-delimited with no leading slash: `samples/12/9f2c…`.
- `read` and `write` stream. Sequencing files are far too large to buffer.
- `write` creates or overwrites and returns the number of bytes written.
- `delete` is idempotent — deleting a key that was never there is not an error.
- `read` and `size` throw `StorageKeyNotFoundError` when the key is absent.
- Everything else that goes wrong throws `StorageError`. Both come from
  `@virtool/storage/errors` and extend plain `Error` — not the data layer's
  `AppError`, which would make the storage package depend on the data one.
  `StorageError`'s constructor stamps the subclass name itself, so a
  `StorageKeyNotFoundError` still reports under that name.

`StorageObjectInfo` carries `key`, `size`, and `lastModified`. The
`lastModified` semantics differ per backend — a server timestamp for a real
bucket, the process clock for `MemoryStorage`. Don't compare it across backends
or rely on it for ordering.

### Cleanup

`deleteKeys(storage, keys)` deletes every object named and **never throws**.
Callers reach it having already committed the database write that orphaned the
objects, so failing the whole operation because one delete failed would abandon
the rest of the cleanup and report failure for work that mostly succeeded. It
returns `{ key, error }` pairs instead. **Log them** — that is the only thing
keeping the orphans observable.

The keys passed in are the ones the rows being deleted recorded, so they have to
be read **before** those rows go. Where a cascade removes child rows — a
sample's analyses take their `analysis_files` with them, an index takes its
`index_files` — the parent's delete collects the children's keys first.

There is no prefix sweep, in either service. Only an object some row names can
be reached, so anything written before keys were recorded — a migrated
analysis's result blobs, above all — survives a delete and is left for a
separate orphan sweep. That sweep does not exist yet.

## Keys

**A key is recorded, not derived.** Every row that names a stored object carries
its complete key in a `storage_key` column, and every read path reads that
column. Nothing recomposes a key from a row id, a legacy id, or a filename, so
changing how keys are chosen cannot force a single object to move.

The columns, all `UNIQUE`:

| Table | Column | Null? |
| --- | --- | --- |
| `sample_reads` | `storage_key` | no |
| `index_files` | `storage_key` | no |
| `sample_artifacts` | `storage_key` | yes |
| `subtraction_files` | `storage_key` | yes |
| `analysis_files` | `storage_key` | yes |
| `uploads` | `storage_key` | yes |
| `indexes` | `otus_json_storage_key` | yes |

A column is nullable exactly where the value it was backfilled from is: the
backfill derived each key from whatever the old read path composed, and where
that source column is nullable a row can exist naming no retrievable object. A
NULL key states that faithfully rather than fabricating one. `indexes` carries
its OTU JSON key directly because that object is materialized on demand and
deliberately has no `index_files` row — one would publish it in the index's file
listing.

New keys come from `@virtool/storage/keys`, and must stay byte-for-byte
compatible with Python's — the leaf is `uuid4().hex`, so **no hyphens**:

| Minter | Key |
| --- | --- |
| `mintStorageKey(domain, parentId)` | `{domain}/{parentId}/{uuid}` |
| `mintRootStorageKey(domain)` | `{domain}/{uuid}` |
| `cacheKey(uuid)` | `caches/v1/{uuid}` |
| `HMM_PROFILES_KEY` | `hmm/profiles.hmm` |
| `HMM_ANNOTATIONS_KEY` | `hmm/annotations.json.gz` |

The `{parentId}` segment groups an owning resource's objects for human
inspection and means nothing to any read path. Uploads have no owning resource —
they are the resource — so they use `mintRootStorageKey`, which also makes the
key available before the row exists: the object is written first, and no
database transaction is held open for the length of the upload stream.

**Keys in the bucket are heterogeneous by design.** A migrated row keeps the
Mongo slug or integer id it was written under; only rows created since get a
UUID. Never infer a key's shape from another key.

A cache's key is persisted on its row too. Read it from there rather than
recomputing it.

### A key crossing the wire is validated, not recomposed

The one place a key arrives from outside is a workflow finalizing its outputs
over the jobs API. The workflow writes the bytes itself, so it is the only party
that knows where they went — the route records the key it sends verbatim rather
than composing a second one that is free to disagree.

Verbatim is not unchecked. Every key is required to sit under
`{domain}/{parentId}/` for the resource named in the route's own path, which is
exactly what `mintStorageKey` produces, plus structural checks: non-empty, no
leading `/`, no empty segment, no `..` segment. So a runner cannot register a row
naming another resource's object, which the delete paths would then destroy on
its behalf.

The exception is `POST /caches`, which takes a bare uuid and composes
`cacheKey(uuid)` server-side. That key *is* derivable, so accepting one would
add a lever without adding information — and Python's LRU eviction deletes by
`storage_key`, so a cache row aimed at a sample object is a route to having
another domain's files destroyed.

## Configuration

Storage is configured through the environment and parsed in
`src/server/config.ts`. `VT_STORAGE_BACKEND` is required and has no default —
it is `s3` or `azure`. There is no filesystem backend; Python dropped it.

| Variable | Backend | Notes |
| --- | --- | --- |
| `VT_STORAGE_BACKEND` | both | `s3` or `azure`. Required. |
| `VT_STORAGE_S3_BUCKET` | s3 | Required. |
| `VT_STORAGE_S3_REGION` | s3 | Optional. |
| `VT_STORAGE_S3_ENDPOINT` | s3 | Optional. Omit for real AWS. |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | s3 | Both-or-neither, see below. |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | s3 | Both-or-neither, see below. |
| `VT_STORAGE_AZURE_ACCOUNT` | azure | Required. |
| `VT_STORAGE_AZURE_CONTAINER` | azure | Required. |
| `VT_STORAGE_AZURE_ACCESS_KEY` | azure | Optional; managed identity if unset. |
| `VT_STORAGE_AZURE_ENDPOINT` | azure | Optional. |

Every variable in the table also has a `_FILE` variant naming a file to read
the value from — `VT_STORAGE_S3_SECRET_ACCESS_KEY_FILE=/mnt/secrets-store/s3-secret-key`.
`config.ts` reads and trims that file before validating, so the credentials can
arrive on a secrets-store CSI mount instead of a Kubernetes `Secret`, which goes
stale when a key is added to the `SecretProviderClass`. The file wins over a
plain variable of the same name, an unreadable path throws at startup, and an
empty file counts as unset.

The **S3 credentials are both-or-neither**. Setting both authenticates with
them; setting neither falls through to the AWS credential chain and an IAM
role. Setting exactly one is rejected at startup rather than quietly ignored,
because the failure mode is a process running in production as the wrong
principal. Empty strings count as unset — deployment tooling routinely injects
an empty value for something it has nothing to put in.

Both-or-neither is judged **after** the files are read, so an S3 access key id
supplied by env and a secret access key supplied by a mount are a valid pair.

The backend is built once at startup, by the composition root at
`apps/web/src/server/composition.ts`, alongside `db` and `client`; **pass it
into `data.ts` functions the way `db` is passed**, as an argument — db handle
first, then storage, then logger. `data.ts` never imports it — that would put
the app's configuration back inside the package's call graph. Use
`createStorageBackend` from `@virtool/storage` when you need a backend without
the singleton.

The package constructs nothing at import time, which is what lets the jobs API
and the workflow ports reuse it, and is why it can declare `sideEffects: false`.

### Never let storage secrets reach the browser

Vite is configured with a `VT_` env prefix, and it serializes **every**
`VT_`-prefixed variable present at build time into the client bundle wherever
client code references the env object as a whole. A single such reference would
ship `VT_STORAGE_S3_SECRET_ACCESS_KEY` to every browser. Client code must read
named keys (`import.meta.env.VT_SENTRY_DSN`), never the object itself. This is
enforced by `src/app/__tests__/clientEnv.test.ts`.

## Backend quirks

Three things about S3 are not optional knowledge; all three are handled in
`s3.ts` and all three were found by running against a real S3-compatible
service.

1. **Path-style addressing, but only for a custom endpoint.** MinIO and Garage
   serve buckets as a path segment, while real AWS expects virtual-hosted
   addressing. `forcePathStyle` is therefore keyed off whether an endpoint is
   configured.
2. **Multipart parts have a 5 MiB floor.** This is a hard S3 minimum, not a
   tuning preference, and it is *not* the streaming chunk size — using the 4 MiB
   `STORAGE_CHUNK_SIZE` as a part size makes every write fail with
   `EntityTooSmall`.
3. **Response checksum validation is off.** A multipart object's stored checksum
   is a composite of its parts, which real S3 marks with a `-N` suffix so the
   SDK knows not to compare it against the whole body. Garage returns it
   unsuffixed, so the SDK compares a per-part checksum to the full object and
   every large read fails. Uploads still send checksums; only the response-side
   comparison is dropped.

Missing keys arrive as `NoSuchKey` from `GetObject` and `NotFound` from
`HeadObject` — a `HEAD` has no body to carry an error code — and S3-compatible
backends are not consistent about which they send, so a 404 status decides.
Azure reports `BlobNotFound` or a 404. Both normalize to
`StorageKeyNotFoundError`.

For Azure, the SDK pools upload chunks with `Buffer.copy`, so a plain
`Uint8Array` reaches it as an object with no `copy` method and the upload dies.
`azure.ts` wraps each chunk as a `Buffer` view — no copy, same bytes.

## Testing

Storage is tested in two layers, mirroring Python.

**Unit tests use `MemoryStorage`.** Anything that stores files takes a
`StorageBackend` argument, so it can be tested without a bucket. Reach for the
fake by default; it is what keeps the ordinary test loop container-free.
Helpers for streaming, draining, and listing are in
`@virtool/storage/test/fixtures`.

**The backends themselves are tested against real services.** The package's
`integration` Vitest project starts Garage (S3-compatible) and Azurite in
testcontainers and runs the same suite against both. These are the tests that
catch the quirks above; `MemoryStorage` cannot. It has its own CI job, so
pulling those images stays out of the fast package loop.

```bash
pnpm test                                                          # everything
pnpm --filter @virtool/storage test                                # both projects
pnpm --filter @virtool/storage exec vitest run --project unit      # no containers
```

Two details of that setup matter if you touch it:

- **Garage will not serve S3 traffic until a cluster layout is applied.** The
  global setup reproduces Python's `garage-init.sh` against the admin API:
  apply a single-node layout, create the bucket, import a fixed key, grant it
  read and write. Every step is idempotent, which is what makes `withReuse()`
  safe.
- **The Garage image is distroless.** Testcontainers' default wait strategy
  confirms a port is bound by running a shell inside the container, which that
  image cannot do, so the wait always times out. The setup waits on a log line
  instead.

Both containers are reused between runs, so a warm run costs a couple of
seconds. Tests share one bucket and one container, and each owns a key prefix
(`test/{worker}/{testName}/`) that it purges before and after, so workers do not
collide.

Server tests run in a **node** Vitest project, not jsdom. Under jsdom the typed
arrays come from a different realm, and bytes read back from storage compare
unequal to the bytes written even when they are identical.
