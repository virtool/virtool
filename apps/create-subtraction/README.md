# @virtool/create-subtraction

Image: `ghcr.io/virtool/ts-create-subtraction`.

Computes GC and sequence count for a subtraction and commits it's 
FASTA to object storage.

Two steps, `compute_gc_and_count` and `finalize`, and one external tool,
`seqkit`.

## Configuration

All variables are read at startup. Each also accepts a `<VARIABLE>_FILE`
variant containing the value; the file takes precedence, surrounding
whitespace is trimmed, and an empty value is treated as unset.

| Variable | Type | Default | Use |
| --- | --- | --- | --- |
| `VT_JOBS_API_URL` | URL | Required | Set the cluster-internal jobs API base URL. |
| `VT_WORK_PATH` | Path string | Required | Set the disposable directory used for one workflow run. |
| `VT_WORKFLOW` | `create_sample` \| `create_subtraction` \| `nuvs` \| `pathoscope` | Required | Select the kind of job this pod claims. |
| `VT_MEM` | Positive integer (GiB) | `4` | Report the memory available to the job and size tool invocations. |
| `VT_PROC` | Positive integer | `2` | Report and limit the processors available to the job. |
| `VT_TIMEOUT` | Positive integer (seconds) | `1000` | Bound the workflow run. |
| `VT_IMAGE` | String | `unknown` | Record the runner image on the claimed job. |
| `VT_SENTRY_DSN` | URL string | Unset | Send errors to Sentry. When unset, Sentry is disabled. |
| `VT_STORAGE_BACKEND` | `s3` \| `azure` | Required | Select the object-storage backend used to transfer inputs and outputs. |
| `VT_STORAGE_S3_BUCKET` | String | Required for S3 | Name the S3 bucket. |
| `VT_STORAGE_S3_REGION` | String | Unset | Set the S3 region. |
| `VT_STORAGE_S3_ENDPOINT` | URL string | Unset | Override the S3 endpoint; leave unset for AWS. |
| `VT_STORAGE_S3_ACCESS_KEY_ID` | String | Unset | Set an explicit S3 access key. Set with `VT_STORAGE_S3_SECRET_ACCESS_KEY`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | String | Unset | Set an explicit S3 secret key. Set with `VT_STORAGE_S3_ACCESS_KEY_ID`, or leave both unset for the AWS credential chain. |
| `VT_STORAGE_AZURE_ACCOUNT` | String | Required for Azure | Name the Azure Storage account. |
| `VT_STORAGE_AZURE_CONTAINER` | String | Required for Azure | Name the Azure Blob container. |
| `VT_STORAGE_AZURE_ACCESS_KEY` | String | Unset | Set an Azure account key; leave unset to use managed identity. |
| `VT_STORAGE_AZURE_ENDPOINT` | URL string | Unset | Override the Azure Blob endpoint. |

`VT_JOBS_API_URL` and `VT_WORK_PATH` intentionally have no defaults.
`VT_JOBS_API_URL` replaces Python's
`VT_JOBS_API_CONNECTION_STRING`; deployment manifests must use the new name.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/create-subtraction build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-subtraction start` | Run the bundle |
| `pnpm --filter @virtool/create-subtraction test` | Vitest |
| `pnpm --filter @virtool/create-subtraction typecheck` | `tsc --noEmit` |
