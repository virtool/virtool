# @virtool/create-sample

Image: `ghcr.io/virtool/ts-create-sample`.

Turns a user's uploaded FASTQ files into a sample an analysis can run against:
measures their quality with FastQC, normalizes them to `reads_1.fq.gz` and
`reads_2.fq.gz`, and commits them to object storage.

Two steps, `run_fastqc` and `finalize`, and one external tool, `fastqc` 0.11.9.

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

**FastQC runs once per read, each into its own output directory.** Python runs
one invocation over both files and then scans the work path for anything holding
a `fastqc_data.txt`, which pairs a report with a read by filesystem order.
Matching them the other way means reimplementing FastQC's suffix-stripping rule,
which is not a contract. One directory per read makes the pairing structural.
It costs nothing: Python passes no `-t`, so both forms process the reads one at
a time.

**`build_index` has no counterpart and there is no delete on failure.** Python
registers an `@hooks.on_failure` that issues `DELETE /samples/{id}`; a failed
run here leaves an unfinalized sample for the user to remove, and the jobs API
exposes no destructive route a job key could reach. This matches
`create_subtraction`, `pathoscope` and `nuvs`.

**The image needs `perl` as well as a JRE.** FastQC 0.11.9 is a Java program
behind a Perl launcher whose first statement is `use FindBin` — which lives in
`perl-modules-5.36`, not the `perl-base` the Node image carries. Without it the
failure is at exec, with a message about `@INC`.

## Fixtures

`src/fixtures/paired_{1,2}.fastqc_data.txt` are real FastQC 0.11.9 output,
produced by `src/fixtures/generate.sh` from a prefix of the paired example
reads. That script is the provenance record and the only thing that should write
them — never hand-edit a fixture to match what the parser happens to produce.

```
apps/create-sample/src/fixtures/generate.sh /path/to/examples/data
```

The parsing itself belongs to `@virtool/bio` (`parseFastqcData`,
`compositeQuality`) and is tested there against synthetic sections; these
fixtures are what check the two against genuine tool output, binned per-base
sections included.
