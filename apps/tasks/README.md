# @virtool/tasks

The task service: **one** long-lived process carrying both halves of Virtool's
task system — the periodic spawner that inserts scheduled tasks, and the runner
that claims and executes what it spawns.

Image: `ghcr.io/virtool/tasks`. No ingress and **no Service** — its
HTTP listener serves only `GET /health/live`, `GET /health/ready` and a
token-gated `GET /metrics` on `VT_TASKS_PROBE_PORT` (**9900**).

Neither half has a flag to turn it off. The cutover from Python is two
deployments inside a minute, and a minute of task lag is invisible to a user,
so a staged rollout buys nothing.

## Shape

Everything is built inside `bootstrap()` (`src/bootstrap.ts`), the composition
root — config, logger, pool, emitter, storage, registry, listener. This app has
no module-scope singleton of any kind, so a module of it can be imported to read
a type without opening anything.

- `src/spawner.ts` — the periodic spawner, over `src/tasks/periodic.ts`
- `src/runner.ts` — claim, dispatch, heartbeat, drain
- `src/framework/` — `defineTask`, the progress writer and `runTask`
- `src/tasks/` — the task bodies, named for the `type` column in skewer case
  (`refresh-hmms.ts` for `refresh_hmms`), registered in `src/tasks/registry.ts`
- `src/download.ts` — downloading a release archive to disk, with the bounded
  retry, idle-stall timeout and status check `install_hmms` needs

A claim is a lease encoded on `acquired_at`, renewed every 60 s and live for
300. A reclaimed task re-runs from step zero, so **every task body must be
idempotent**.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/tasks build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/tasks start` | Run the bundle |
| `pnpm --filter @virtool/tasks test` | Run the Vitest suite (needs Docker — Postgres testcontainer) |
| `pnpm --filter @virtool/tasks typecheck` | `tsc --noEmit` |

## Configuration

All variables are read at startup. Each also accepts a `<VARIABLE>_FILE`
variant containing the value; the file takes precedence, surrounding
whitespace is trimmed, and an empty value is treated as unset.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool. |
| `VT_TASKS_PROBE_PORT` | Positive integer | `9900` | Listen for health probes and Prometheus scrapes. |
| `VT_TASKS_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `40` | Bound the complete graceful-shutdown sequence. It must remain below the pod termination grace period. |
| `VT_TASKS_DRAIN_TIMEOUT` | Positive integer (seconds) | `25` | Allow an in-flight task to finish before releasing its claim. This must be less than `VT_TASKS_SHUTDOWN_TIMEOUT` and is part of that budget. |
| `VT_METRICS_TOKEN` | String | Unset | Enable `/metrics` and authenticate scrapes with a bearer token. When unset, `/metrics` returns 404. |
| `VT_SENTRY_DSN` | URL string | Unset | Send errors to Sentry. When unset, Sentry is disabled. |
| `VT_STORAGE_BACKEND` | `s3` \| `azure` | Required | Select the object-storage backend shared with the other Virtool services. |
| `VT_STORAGE_S3_BUCKET` | String | Required for S3 | Name the S3 bucket. |
| `VT_STORAGE_S3_REGION` | String | Unset | Set the S3 region. |
| `VT_STORAGE_S3_ENDPOINT` | URL string | Unset | Override the S3 endpoint; leave unset for AWS. |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | String | Unset | Set an explicit S3 access key. Set with `VT_STORAGE_S3_SECRET_ACCESS_KEY`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | String | Unset | Set an explicit S3 secret key. Set with `VT_STORAGE_S3_ACCESS_KEY_ID`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_AZURE_ACCOUNT` | String | Required for Azure | Name the Azure Storage account. |
| `VT_STORAGE_AZURE_CONTAINER` | String | Required for Azure | Name the Azure Blob container. |
| `VT_STORAGE_AZURE_ACCESS_KEY` | String | Unset | Set an Azure account key; leave unset to use managed identity. |
| `VT_STORAGE_AZURE_ENDPOINT` | URL string | Unset | Override the Azure Blob endpoint. |

## Documentation

`docs/tasks.md` covers the `AppContext` contract, shutdown
ordering, the lease and fencing rules, the framework's step model, the runner's
loop and the task-body contracts in full. `docs/apps.md` covers the bundling
and `pnpm deploy` pipeline every non-Vite app shares, and `docs/images.md` the
image pipeline.
