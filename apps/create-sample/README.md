# @virtool/create-sample

Image: `ghcr.io/virtool/create-sample`.

Turns a user's uploaded FASTQ files into a sample an analysis can run against:
normalizes them to `reads_1.fq.gz` and `reads_2.fq.gz`, measures their quality,
and commits them to object storage. Uploads can be plain, gzip, or bzip2.

Three steps, `normalize_reads`, `run_fastqc` and `finalize`, and three external
binaries: `lbzip2`, `pigz` and
[`quality-core`](../../packages/quality-core/README.md), a Rust crate in this
repo rather than a third-party tool.

## Building the image

The shared workflow-tools Dockerfile uses cargo-chef to build `quality-core`,
then the app Dockerfile copies it into a runtime that installs `lbzip2` and
`pigz` from apt:

```console
docker buildx bake -f packages/image-build/docker-bake.hcl create-sample
```

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the complete environment-variable table and configuration rules.

## Commands

Run from the monorepo root.

| Command                                          | Action                     |
| ------------------------------------------------ | -------------------------- |
| `pnpm --filter @virtool/create-sample build`     | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-sample start`     | Run the bundle             |
| `pnpm --filter @virtool/create-sample test`      | Vitest                     |
| `pnpm --filter @virtool/create-sample typecheck` | `tsc --noEmit`             |

## Decisions

**Its input is `WorkflowSample.uploads`, and the count comes from there.** A
sample this workflow is running has no `sample_reads` rows yet, so the uploads
are the only files it has. They ride on `GET /samples/{id}` for the same reason
a subtraction's upload does. The job's `args` carry `sample_id` and nothing
else. Their order is `sample_uploads.index`, which is the _only_ thing linking
an upload to the reads file it becomes: `finalizeSample` pairs the rows it
writes with the uploads by that same order.

Don't branch on `sample.paired`. `getSample` derives it from the reads rows,
so a running `create_sample` job is always served `paired: false`.

**An already-gzipped upload is renamed, not re-encoded.** Almost every one is,
and these files run to gigabytes. Recompressing means decompressing
and gzipping back to produce bytes the user already sent.

**A bzip2 upload is converted to gzip before anything else reads it.**
`quality-core` reads only gzip and plain text, and every later consumer expects
`reads_{n}.fq.gz`. For this reason, `normalize_reads` runs first. The conversion
goes through a pipe, so the decompressed FASTQ never reaches the disk. The first
bytes of the file decide the format, not its name.

**`lbzip2` decompresses, not `pbzip2`.** `pbzip2` decompresses in parallel only
the files that `pbzip2` made. With four threads on a file that `bzip2` made, it
took 13.7 seconds. `bzip2` took 9.6 seconds and `lbzip2` took 1.8 seconds.

**The normalized reads go in `{work_path}/reads/`, not beside their uploads.**
Writing them next to their sources as `reads_{i + 1}.fq.gz` is a collision
waiting to happen: upload names are user-supplied, so a sample whose _second_
upload is called `reads_1.fq.gz` would have the first upload renamed onto it,
destroying the second's bytes and causing finalization to store one read twice.
Separate directories put the target names out of reach of the source names. The
rename is still a rename. Both directories are under the one work path, which
is all `rename(2)` requires.

**`quality-core` computes the quality statistics, while the step id still names
FastQC.** The crate computes the seven stored fields in one streaming pass. See
its README for the definitions and the deliberate difference in base-position
binning.

The step id is `run_fastqc`, because a step id is stored in the `jobs.steps`
column and rendered by the UI, so renaming one changes what users see. Its
_display name_ is "Measure quality": that's a label rather than a key, and
naming FastQC there would name a tool this image no longer carries.

**It runs once per read, each writing its own results file.** A single
invocation over both files would have to be paired back to its read by scanning
the work path for the report it wrote, which pairs by filesystem order. One
file per read, named by the read's position, makes the pairing structural
instead. Reducing the two blobs to the composite a sample stores stays here, in
`compositeQuality` from `@virtool/bio`, which averages the two paired-end
quality objects.

**No delete on failure.** A failed run leaves an unfinalized sample for
the user to remove, and the jobs API exposes no destructive route a job key
could reach. This matches `create_subtraction`, `pathoscope` and `nuvs`.

**The runtime installs only `lbzip2` and `pigz`.** `quality-core` links only
glibc, so it doesn't require a JRE, Python, Perl, or additional shared
libraries. The conversion pipeline uses the `bash` from the base image, because
`dash` has no `pipefail`.

## Fixtures

The tests here use small blobs built inline; nothing in this app parses a
FastQC report any more.

The statistics are pinned in the crate against real FastQC 0.11.9 output. See
`packages/quality-core/tests/fixtures/`.
