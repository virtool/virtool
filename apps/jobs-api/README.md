# @virtool/jobs-api

The service workflow runners use to claim, update, and finish jobs.

See [Job lifecycle](../../docs/jobs.md) for the protocol shared with
`@virtool/workflow`, including cancellation, failure, retries, and exit codes.

Image: `ghcr.io/virtool/jobs-api`.

## Configuration

All variables are read at startup. Each also accepts a `<VARIABLE>_FILE`
variant containing the value; the file takes precedence, surrounding
whitespace is trimmed, and an empty value is treated as unset.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_JOBS_API_HOST` | String | `0.0.0.0` | Set the interface on which the API listens. |
| `VT_JOBS_API_PORT` | Positive integer | `9950` | Set the API listen port. |
| `VT_JOBS_API_SHUTDOWN_TIMEOUT` | Positive integer (seconds) | `30` | Bound graceful shutdown. It must remain below the pod termination grace period. |
| `VT_POSTGRES_URL` | URL | Required | Connect to the Virtool Postgres database. |
| `VT_POSTGRES_POOL_MAX` | Positive integer | `10` | Limit the Postgres connection pool. |
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

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/jobs-api build` | Bundle the service. |
| `pnpm --filter @virtool/jobs-api start` | Run the bundle. |
| `pnpm --filter @virtool/jobs-api test` | Run the Vitest suite. |
| `pnpm --filter @virtool/jobs-api typecheck` | Run `tsc --noEmit`. |
