# @virtool/workflow

The runtime, jobs API client, subprocess runner, file-transfer layer, cache,
and test harness shared by Virtool workflow executors.

## Runtime contract

- Define workflows with `defineWorkflow()` and an explicit ordered step array.
  Step IDs use snake case and must match the Python step names stored by the
  jobs API.
- Build the run context once with `buildContext`. Its `data` field must survive
  a JSON round trip; use `state` for mutable step-to-step data.
- `runWorkflow()` returns an outcome. It does not use the network, install
  signal handlers, exit the process, run teardown, or provide lifecycle hooks.
- `runWorkflowApp()` owns configuration, job claiming, pings, cancellation,
  reporting, Sentry flushing, and process exit.
- Cancellation is cooperative. The runtime abandons the active step when its
  signal aborts and safely observes any later rejection.

### Subprocesses

Run every external tool through `context.runSubprocess`:

- stdout goes to `/dev/null` unless a handler consumes it;
- stderr is logged line by line and the last 20 lines are attached to failures;
- lines are limited to 128 MiB by default;
- the child runs in a process group so cancellation kills descendants;
- cancellation sends `SIGTERM`, then `SIGKILL` after five seconds.

### Job lifecycle

See [Job lifecycle](../../docs/jobs.md) for the complete protocol and the
ownership boundary between this package and `@virtool/jobs-api`.

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

`VT_JOBS_API_URL` and `VT_WORK_PATH` intentionally have no defaults. The URL
replaces Python's `VT_JOBS_API_CONNECTION_STRING`; deployment manifests must
use the new name for TypeScript workflow images.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/workflow test` | Run tests. |
| `pnpm --filter @virtool/workflow test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/workflow typecheck` | Type-check the package. |
