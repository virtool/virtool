# @virtool/nuvs

NuVs finds viruses the reference does **not**
describe: it discards every read that maps to a known OTU or to a
subtraction, assembles what is left with SPAdes, and searches the contigs for
viral motifs with HMMER.

Image: `ghcr.io/virtool/ts-nuvs`. Ten steps, five external tools — `skewer`,
`bowtie2`, SPAdes, `hmmpress` and `hmmscan`.

## Five rules it carries

- **SPAdes 4.2.0 is compiled from source**, because no binary release fits the
  base, and the runtime installs `python3` for it — `spades.py` is a Python
  script driving the compiled assembler binaries.
- **The raw `results` shape is pinned by `formatNuvs`**
  (`packages/data/src/analyses/format.ts`), *not* by
  `packages/contracts/src/nuvs.ts`, which describes the **formatted**
  envelope. The workflow writes each ORF hit's `hit` (an annotation id) and
  never `cluster`, `families` or `names`, which the server merges in from the
  `hmms` table.

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
| `pnpm --filter @virtool/nuvs build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/nuvs start` | Run the bundle |
| `pnpm --filter @virtool/nuvs test` | Run the Vitest suite |
| `pnpm --filter @virtool/nuvs test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/nuvs typecheck` | `tsc --noEmit` |
