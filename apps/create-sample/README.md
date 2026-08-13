# @virtool/create-sample

Image: `ghcr.io/virtool/ts-create-sample`.

Turns a user's uploaded FASTQ files into a sample an analysis can run against:
measures their quality, normalizes them to `reads_1.fq.gz` and
`reads_2.fq.gz`, and commits them to object storage.

Two steps, `run_fastqc` and `finalize`, and one external binary,
[`quality-core`](../../packages/quality-core/README.md) — a Rust crate in this
repo rather than a third-party tool.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/create-sample build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-sample start` | Run the bundle |
| `pnpm --filter @virtool/create-sample test` | Vitest |
| `pnpm --filter @virtool/create-sample typecheck` | `tsc --noEmit` |

## Decisions

**Its input is `WorkflowSample.uploads`, and the count comes from there.** A
sample this workflow is running has no `sample_reads` rows yet, so the uploads
are the only files it has. They ride on `GET /samples/{id}` for the same reason
a subtraction's upload does — the job's `args` carry `sample_id` and nothing
else. Their order is `sample_uploads.index`, which is the *only* thing linking
an upload to the reads file it becomes: `finalizeSample` pairs the rows it
writes with the uploads by that same order.

Do not branch on `sample.paired`. `getSample` derives it from the reads rows,
so a running `create_sample` job is always served `paired: false`.

**An already-gzipped upload is renamed, not re-encoded.** Almost every one is,
and these files run to several gigabytes — recompressing means decompressing
and gzipping back to produce bytes the user already sent. Python takes the same
branch.

**The normalized reads go in `{work_path}/reads/`, not beside their uploads.**
Python writes them with `path.with_name(f"reads_{i + 1}.fq.gz")`, which is a
collision waiting to happen: upload names are user-supplied, so a sample whose
*second* upload is called `reads_1.fq.gz` has Python rename the first upload
onto it, destroy the second's bytes, and finalize with one read stored twice.
Separate directories put the target names out of reach of the source names. The
rename is still a rename — both directories are under the one work path, which
is all `rename(2)` requires.

**`quality-core` replaced FastQC, and the step id did not change.** FastQC is a
Java program behind a Perl launcher that forced a JRE and the full `perl` into
this image, held ~250 MB per file in flight, and produced a blob small enough
to be beside the point. The crate computes the same seven fields in one
streaming pass — see its README for the statistics it reproduces and the one
place it deliberately differs, which is that it does not reproduce FastQC's
base-position binning.

The step is still `run_fastqc`, because the jobs API stores a step id and
renaming one changes the shape of a job's step list at cutover. Its *display
name* did change, to "Measure quality": that is a label rather than a key, and
keeping it would name a tool this image no longer carries.

**It runs once per read, each writing its own results file.** Python runs one
FastQC invocation over both files and then scans the work path for anything
holding a `fastqc_data.txt`, which pairs a report with a read by filesystem
order. One file per read, named by the read's position, makes the pairing
structural instead. Pairing the two blobs into the composite a sample stores
stays here, in `compositeQuality` from `@virtool/bio`, which is the port of
Python's averaging and is tested against it.

**`build_index` has no counterpart and there is no delete on failure.** Python
registers an `@hooks.on_failure` that issues `DELETE /samples/{id}`; a failed
run here leaves an unfinalized sample for the user to remove, and the jobs API
exposes no destructive route a job key could reach. This matches
`create_subtraction`, `pathoscope` and `nuvs`.

**The image installs nothing.** It used to need a JRE *and* the full `perl` for
FastQC, whose launcher opens with `use FindBin` — which lives in
`perl-modules-5.36`, not the `perl-base` the Node image carries, and whose
absence failed at exec with a message about `@INC`. `quality-core` is one
static binary linking nothing but glibc, so the runtime stage copies it in and
that is all. The image went from 886 MB to 491 MB.

## Fixtures

The tests here use small blobs built inline; nothing in this app parses a
FastQC report any more.

The statistics are pinned in the crate, against real FastQC 0.11.9 output —
see `packages/quality-core/tests/fixtures/`.
