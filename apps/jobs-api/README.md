# @virtool/jobs-api

The service workflow runners use to claim, update, and finish jobs.

See [Job lifecycle](../../docs/jobs.md) for the protocol shared with
`@virtool/workflow`, including cancellation, failure, retries, and exit codes.

Image: `ghcr.io/virtool/jobs-api`.

## Workflow files and finalization

Workflow runners transfer bytes directly through object storage. The jobs API
records and serves complete storage keys; it does not derive a key from a row
id, legacy id, or filename.

A runner mints an output key with `mintStorageKey(domain, parentId)`, uploads
the object, and sends that key in one resource-finalization request:

- `PATCH /samples/{id}`;
- `PATCH /subtractions/{id}`; or
- `PATCH /analyses/{id}`.

The request carries the resource fields and its complete file manifest so the
parent cannot become ready without its file rows. Manifests omit `size` and
`name_on_disk`; the route validates that each non-empty key is beneath the
resource's `{domain}/{parentId}/` prefix, reads the object's size from storage,
and records the submitted key verbatim. Keys with a leading slash, an empty
segment, or a `..` segment are invalid.

The shared contracts enforce the minimum usable output: a sample has one or two
reads, a subtraction has at least its source FASTA, and an analysis requires
`results` but may have an empty file manifest. Subtraction runs write only
`subtraction.fa.gz`; reads still serve older subtractions whose rows also
contain Bowtie2 files.

Caches are the sole key-composition exception. `POST /caches` accepts a bare
UUID and composes its cache key server-side. The workflow uploads the cache blob
before registering it, and an already-registered logical key is success.

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

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project has its own CI job and is excluded from `Packages / Test` so container
startup is not part of the fast package loop. It imports the shared container
setup from `@virtool/data/db/test/globalSetup`.
