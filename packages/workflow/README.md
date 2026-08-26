# @virtool/workflow

The runtime, jobs API client, subprocess runner, file-transfer layer, cache,
and test harness shared by Virtool workflow executors.

## Runtime contract

- Define workflows with `defineWorkflow()` and an explicit ordered step array.
  Step IDs use snake case and are stored verbatim by the jobs API.
- Build the run context once with `buildContext`. Its `data` field must survive
  a JSON round trip; use `state` for mutable step-to-step data.
- `runWorkflow()` returns an outcome. It does not use the network, install
  signal handlers, exit the process, run teardown, or provide lifecycle hooks.
- `runWorkflowApp()` owns configuration, job claiming, pings, cancellation,
  reporting, Sentry flushing, and process exit.
- Cancellation is cooperative. The runtime abandons the active step when its
  signal aborts and safely observes any later rejection.

The runtime is deliberately small and explicit:

- There is no dependency-injection container. Each workflow builds one ordinary
  context before its first step. Metadata resolution is eager, but transfer may
  remain lazy: `buildContext` records storage keys and work paths and checks
  required objects with `storage.size()`, while the step that needs an optional
  input downloads it.
- There is no teardown layer. Workflow containers are ephemeral, and process
  exit reclaims their work directory. Do not add `dispose`,
  `Symbol.asyncDispose`, or an `AsyncExitStack` equivalent.
- There is no lifecycle-hook registry. `RunWorkflowOptions.onStepStart` is the
  sole optional callback. Successful completion is represented by the returned
  `RunOutcome`; a failed run leaves a partially built resource for the user to
  delete.

`createWorkflowContext()` verifies on every run that `data` survives a JSON
round trip. Put storage keys, paths, ids, and other serializable inputs there;
put live handles and mutable cross-step scratch in `state`. This boundary is
also the serialization seam for the end-to-end test bed.

### Subprocesses

Run every external tool through `context.runSubprocess`:

- stdout goes to `/dev/null` unless a handler consumes it;
- stderr is logged line by line and the last 20 lines are attached to failures;
- lines are limited to 128 MiB by default;
- the child runs in a process group so cancellation kills descendants;
- cancellation sends `SIGTERM`, then `SIGKILL` after five seconds.

### Reference representatives

`selectReferenceRepresentatives()` streams full-reference OTUs and runs one
single-threaded `cd-hit-est` process per OTU and declared segment. Its exported
policy fixes global identity at `0.80`, word size at `5`, minimum length at `9`,
and uses no coverage controls. Callers provide the scratch path, subprocess
runner, and concurrency bound; the selector yields original sequence records in
deterministic group and cluster order and removes its temporary files on every
exit path.

Invalid grouping, malformed or incomplete cluster output, and subprocess
failure reject selection. There is no default-sequence or all-sequence fallback.

`createRunSubprocess()` logs `ESRCH` and `EPIPE` from a signal racing process
exit at debug level. An ordinary tool exit with code 15 is a failure; only a
cancellation-driven kill resolves with `cancelled: true`.

### Job lifecycle

See [Job lifecycle](../../docs/jobs.md) for the complete protocol and the
ownership boundary between this package and the jobs API (`@virtool/internal`).

- Claim paths are unprefixed and wire fields are camel case.
- A pod gets its job ID and credential from the claim response.
- Transport failures retry five times at five-second intervals. HTTP responses
  are not retried.
- The ping loop treats `401` as cancellation. Five consecutive other failures
  stop the ping loop but do not stop the workflow.
- A completed or failed workflow exits `0`; the jobs API owns those state
  transitions. A broken runner exits `1`, and `SIGTERM` exits `124`.

### Files and cache

- Pass one `StorageBackend` into the run context. Tests use `MemoryStorage`.
- Transfer files with `downloadToPath()` and `uploadFromPath()`; never buffer
  workflow files in memory.
- Read storage keys from API records. Mint output keys with `mintStorageKey()`
  and send them back in the finalize manifest; never derive them from row IDs.
- `createWorkflowCache()` stores an uncompressed tar containing one top-level
  directory. Upload the blob before registering the cache row.

`runWorkflowApp()` constructs the storage backend once from configuration and
passes it through the context. The workflow package never constructs a
database connection or a module-level storage singleton.

The cache archive's one top-level entry is the cached directory's basename.
That layout is what lets every workflow share the `reference_mapping_index` and
`subtraction_mapping_index` namespaces. Registering an already-existing cache
key is success. `deriveCacheKey()` serialises params as JSON with keys sorted
by code point, `,` and `:` separators, and every character outside
`0x20`–`0x7E` escaped, then takes the SHA-256 of the result; mark floats with
`float()`, and do not change the frozen golden fixtures to match what the
implementation currently produces.

Tar and gzip operations belong to `@virtool/archive`; this package does not
re-export them.

## Configuration

`parseWorkflowRunConfig()` reads these variables when an app starts. Every
variable also accepts `<VARIABLE>_FILE`; the file wins, whitespace is trimmed,
and an empty value is unset. An unreadable file fails startup. The package does
not read `process.env` at import time.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_JOBS_API_URL` | URL | Required | Set the cluster-internal jobs API base URL. |
| `VT_WORK_PATH` | Path string | Required | Set the disposable run directory. |
| `VT_WORKFLOW` | `create_sample` \| `create_subtraction` \| `nuvs` \| `pathoscope` | Required | Select the job type to claim. |
| `VT_MEM` | Positive integer (GiB) | `4` | Report available memory and size tool invocations. |
| `VT_PROC` | Positive integer | `2` | Report and limit available processors. |
| `VT_TIMEOUT` | Positive integer (seconds) | `1000` | Bound the workflow run. |
| `VT_IMAGE` | String | `unknown` | Record the runner image on the job. |
| `VT_SENTRY_DSN` | URL string | Unset | Send errors to Sentry. |
| `VT_STORAGE_BACKEND` | `s3` \| `azure` | Required | Select object storage. |
| `VT_STORAGE_S3_BUCKET` | String | Required for S3 | Name the S3 bucket. |
| `VT_STORAGE_S3_REGION` | String | Unset | Set the S3 region. |
| `VT_STORAGE_S3_ENDPOINT` | URL string | Unset | Override the S3 endpoint; omit for AWS. |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | String | Unset | Set with the S3 secret key, or omit both for the AWS credential chain. |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | String | Unset | Set with the S3 access key, or omit both for the AWS credential chain. |
| `VT_STORAGE_AZURE_ACCOUNT` | String | Required for Azure | Name the Azure Storage account. |
| `VT_STORAGE_AZURE_CONTAINER` | String | Required for Azure | Name the Azure Blob container. |
| `VT_STORAGE_AZURE_ACCESS_KEY` | String | Unset | Set an account key; omit for managed identity. |
| `VT_STORAGE_AZURE_ENDPOINT` | URL string | Unset | Override the Azure Blob endpoint. |

Storage is required because workflow pods transfer their own files. The S3
access and secret keys must be set together or both omitted.

`VT_JOBS_API_URL` and `VT_WORK_PATH` intentionally have no defaults. A missing
value fails startup loudly rather than leaving a pod polling nothing or
deleting whatever a relative work path resolves to.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/workflow test` | Run tests. |
| `pnpm --filter @virtool/workflow test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/workflow typecheck` | Type-check the package. |

## Testing

The package runs its server-shaped tests under Node through its own `test`
script, which the recursive workspace test command discovers. Keep this project
out of `apps/web/vitest.config.js`; the workflow harness has no dependency on
the SPA. Place tests beside their source as `*.test.ts`.

Workflow data generators, jobs API fakes, and process fakes live in
`src/testing/` and are imported through `@virtool/workflow/testing`. Do not
duplicate them in `apps/web/src/tests/` or a workflow app. Tests that store
files use `MemoryStorage`.

See [Workflow testing](TESTING.md) for the harness factories, shared jobs API
state, deterministic builders, subprocess fake, storage helpers, work paths,
and checksum utilities.
