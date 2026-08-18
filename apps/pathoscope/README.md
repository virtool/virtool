# @virtool/pathoscope

The pathoscope workflow executor. Pathoscope quantifies known viruses in a
sample: it collapses redundant isolates out of the reference, maps the sample
against one representative per OTU to find candidates, rebuilds an index
carrying every isolate of just those OTUs, maps again, drops reads that belong
to the host, and reassigns the reads that matched more than one isolate.

Image: `ghcr.io/virtool/ts-pathoscope`. Eight steps, four external
tools — `bowtie2`, `cd-hit-est`, `pigz`, `samtools` — and `pathoscope-core`,
which it drives **as a subprocess**; there is no FFI here and adding one is out
of scope by decision.

## Two rules it carries

- **It writes no result file.** Python uploaded a `report.tsv` whose every
  figure is already in the `results` blob, so the finalize manifest is empty and
  `FinalizeAnalysisRequest.files` allows that for this workflow's sake.
- **Nothing deletes an analysis on failure.** Python's `on_failure` hook is not
  ported and the jobs API has no delete route.

## Building the image

Its stages in the root `Dockerfile` are a cargo-chef build of
`packages/pathoscope-core`, a Node build on the shared `base`, and a runtime
layering the `bowtie2`, `cd-hit` and `samtools` tool stages over both, with
`pigz` from apt:

```
docker build --target pathoscope .
```

### The runtime stage installs interpreters, not just libraries

Two of the four tools are scripts, not ELF binaries, and `node:24-bookworm-slim`
carries neither interpreter in full:

| Tool | Shebang | Needs |
| --- | --- | --- |
| `bowtie2` | `#!/usr/bin/env perl` | full `perl` — the slim base ships `perl-base`, which omits `Sys::Hostname` |
| `bowtie2-build` | `#!/usr/bin/env python3` | `python3` with the stdlib — `python3-minimal` omits it and the script dies on `import gzip` |

`bowtie2-build` is the wrapper that picks between the real `bowtie2-build-s` and
`bowtie2-build-l` by index size. Calling those directly and porting bowtie2's own
size heuristic is the alternative to shipping python3, and it belongs here rather
than in a shared base if it is ever taken.

The shared libraries each back a specific `ldd ... => not found`: `libgomp1` for
bowtie2's OpenMP, `libcurl4` and `libncursesw6` for samtools. `pathoscope-core`
needs none of them — `hts-sys` links htslib statically.

A missing interpreter does not fail the build; it fails the first time the step
runs in a pod. Verify a shebang against the version the `Dockerfile` pins, never
upstream's current source:

```
docker build --target bowtie2 -t vt-tool-bowtie2 .
docker run --rm vt-tool-bowtie2 head -1 /tools/bowtie2/2.5.4/bowtie2-build
```

### Publishing

`Pathoscope / Build` compiles the image on every run and `release-ghcr`
publishes it on release, alongside `virtool/workflow-pathoscope`'s
`ghcr.io/virtool/pathoscope`. The names differ, so the cluster picks one by the
image it pulls and neither stream overwrites the other.

Its release-matrix entry carries `cache-scope: pathoscope`, because the build
job writes its gha cache under that bare scope rather than under the image
name. Without the override the release would rebuild the Rust crate and every
tool stage from scratch inside a 20-minute timeout.

**`ghcr.io/virtool/ts-pathoscope`'s older tags predate all this** — a
short-lived publish job left them behind before the port landed, so `:latest`
is a tools-only image with no workflow code in it. Don't read it as current
until a release has run since publishing was restored.

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
| `pnpm --filter @virtool/pathoscope build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/pathoscope start` | Run the bundle |
| `pnpm --filter @virtool/pathoscope test` | Run the Vitest suite |
| `pnpm --filter @virtool/pathoscope test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/pathoscope typecheck` | `tsc --noEmit` |

The Rust crate is not a pnpm workspace — run `cargo test` in
`packages/pathoscope-core` directly. Building it needs `libclang-dev`.

## Documentation

`docs/workflow-runtime.md` covers the runtime every executor runs on,
[`packages/pathoscope-core/README.md`](../../packages/pathoscope-core/README.md)
the Rust crate,
[`packages/sqlite/README.md`](../../packages/sqlite/README.md) the SQLite
reference index it reads, `docs/apps.md` the bundling and `pnpm deploy`
pipeline every non-Vite app shares, and `docs/images.md` the image pipeline.
