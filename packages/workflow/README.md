# @virtool/workflow

The runtime that every Virtool workflow image runs, and the shared test harness
for workflows. A workflow pod claims one job, runs its steps, reports to the
jobs API, and exits. See [Job lifecycle](../../docs/jobs.md) for the protocol,
retries, and exit codes.

## Error reporting

With `VT_SENTRY_DSN` set, a pod sends a Sentry exception for each failed claim,
preparation, step, and finish call. It tags each exception with `workflow` and,
after the claim, `jobId`. The pod also sends log records at `info` and above to
Sentry logs. Cancellation, termination, and a jobs API refusal that names a
terminal job state send no exception.

## Subprocesses

A pod runs each external tool in a separate process group and logs its stderr
line by line. A tool failure includes the last 20 lines of stderr. When a run
stops, the process group gets `SIGTERM`, then `SIGKILL` after five seconds.

## Caches

Pods keep cached artifacts in object storage and register them with the jobs
API. Each cache key includes the workflow name and version, so a new workflow
version builds its artifacts again.

## Configuration

A workflow app reads these variables when it starts. Every variable also accepts
a `<VARIABLE>_FILE` variant. See
[Environment configuration](../../docs/env.md). An empty value is unset.

| Variable          | Type                                                              | Default   | Use                                                |
| ----------------- | ----------------------------------------------------------------- | --------- | -------------------------------------------------- |
| `VT_JOBS_API_URL` | URL                                                               | Required  | Set the cluster-internal jobs API base URL.        |
| `VT_WORK_PATH`    | Path string                                                       | Required  | Set the disposable run directory.                  |
| `VT_WORKFLOW`     | `create_sample` \| `create_subtraction` \| `nuvs` \| `pathoscope` | Required  | Select the job type to claim.                      |
| `VT_MEM`          | Positive integer (GiB)                                            | `4`       | Report available memory and size tool invocations. |
| `VT_PROC`         | Positive integer                                                  | `2`       | Report and limit available processors.             |
| `VT_TIMEOUT`      | Positive integer (seconds)                                        | `1000`    | Limit the time that a pod waits to claim a job.    |
| `VT_IMAGE`        | String                                                            | `unknown` | Record the runner image on the job.                |
| `VT_SENTRY_DSN`   | URL string                                                        | Unset     | Send errors to Sentry.                             |

Pods read and write their own files, so each pod also needs
[the storage settings](../../docs/storage.md#configuration).

A pod deletes the contents of `VT_WORK_PATH` when a run starts. It also stages
cache archives there, so size that volume for the largest artifact.

## Commands

Run from the monorepo root.

| Command                                      | Action                   |
| -------------------------------------------- | ------------------------ |
| `pnpm --filter @virtool/workflow test`       | Run tests.               |
| `pnpm --filter @virtool/workflow test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/workflow typecheck`  | Type-check the package.  |

## Testing

Tests run under Node, beside their source. Workflow apps get their fixtures and
fakes from the test harness that this package exports.
