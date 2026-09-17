# quality-core

Read quality statistics for one FASTQ file, built as a standalone
command-line binary that
[`@virtool/create-sample`](../../apps/create-sample/README.md) invokes as a
subprocess. It replaced FastQC 0.11.9 in that workflow.

One of two Rust crates here; the other is
[`pathoscope-core`](../pathoscope-core/README.md). Neither is a pnpm workspace
member, so `pnpm test` doesn't reach them. Run `cargo` in this directory, and
CI gates it with a `quality-test` job.

```
quality-core --input reads_1.fq.gz --output quality.json
```

One invocation, one file, one blob. Gzipped or plain; the results go to
`--output` and never to stdout, because the workflow runtime opens a
subprocess's stdout on `/dev/null` unless it's given a handler.

## It computes FastQC's statistics, not the textbook ones

The output is the seven fields of the `Quality` object in
`packages/contracts/src/samples.ts`, which defines what `legacy_samples.quality`
holds.

None of the definitions is the obvious one, and each is ported from a named
Java file:

| Field | FastQC source | The part that surprises |
| --- | --- | --- |
| `bases` | `PerBaseQualityScores.java`, `QualityCount.java` | Percentiles are a cumulative walk over an integer histogram, not an interpolation, so every one is a whole number |
| `composition` | `PerBaseSequenceContent.java` | The denominator is A+C+G+T, so `N` is excluded from it |
| `count`, `gc`, `length`, `encoding` | `BasicStats.java` | `%GC` is *integer* division and has already lost its fraction |
| `sequences` | `PerSequenceQualityScores.java` | The per-read mean truncates the summed **raw** characters before subtracting the encoding offset |

Two more that are easy to miss:

- **The encoding is decided by the single lowest quality character in the whole
  file**, and that decision sets the offset every score in the blob is measured
  against. A file of nothing but high scores reads as Illumina, not Sanger.
- **A cycle covered by 100 reads or fewer has no percentiles.** FastQC reports
  `NaN` for all five, which can't be stored because it's not valid JSON and is
  rejected by both the JSONB column and the `Quality` schema. The row instead
  uses the mean for all five values. This isn't a rare shape: a file of
  variable-length reads thins out toward its longest read.

**Don't "correct" any of these.** The blob is compared against the ones
samples already hold, and a more defensible statistic is a divergence in stored
data.

## One divergence is deliberate: no binning

FastQC groups base positions once the longest read passes **75bp**, reporting
one averaged row per group and repeating it across the group's members. Thus, a
stored blob from a 301bp run holds runs of five identical rows. This crate
reports every cycle.

The shape is unchanged, so no backfill or chart changes are needed. The data has
finer per-cycle resolution. For reads of 75bp or less, there is no divergence.

`tests/fastqc.rs` pins the difference rather than tolerating it: for a binned
case it asserts that the five non-per-cycle fields are identical, that the row
count is identical, that positions 1-9 (which FastQC leaves ungrouped at any
length) are identical, and that **every grouped row is the mean of the cycles
this crate reports for it**. This makes the finer data a refinement
of the coarser one rather than a different measurement.

## The goldens come from FastQC, and must keep coming from FastQC

`tests/fixtures/*.json` are derived from real FastQC 0.11.9 reports. The field
table earlier in this document records how each field maps onto `Quality`.
**Never edit a golden to make a failing comparison pass**, and never derive one
from this crate. Doing so would hide a divergence by making the test assert the
crate's existing behavior.

If a golden is wrong, re-derive it from FastQC 0.11.9. FastQC requires a JRE and
the full `perl` package because its launcher uses `FindBin`. Run FastQC over the
committed synthetic input with `-f fastq --extract`, then calculate the expected
`quality` and `baseGroups` from the raw report using the field table. Don't use
this crate's parser to produce the expected values.

Each fixture targets a specific branch:

| Case | What it's for |
| --- | --- |
| `unbinned` | 400 reads of exactly 75bp. This is the deepest possible cycle-for-cycle comparison. Exact equality |
| `variable` | Plain input with lengths of 30/55/75. Tail cycles are covered by exactly 100 reads, then 40. This is the row-collapse rule. Exact equality |
| `all_n` | One cycle where every read is `N`. This is the zero-denominator rule. Exact equality |
| `binned` | 400 reads of 150bp. This is the one deliberate divergence. |

`tests/fixtures/rounding.jsonl` is a separate corpus of 2,058
`{value, digits, expected}` cases. Each `expected` value is the exact binary
double rounded half to even at `digits` places. The corpus pins
`round_half_even`, and the TypeScript `roundHalfEven` function in `packages/bio`
must produce the same results. Treat this corpus like the other golden fixtures:
don't derive expected values from either implementation under test.

## Dependencies stay small

`needletail` for FASTQ parsing, with **`default-features = false` and only
`flate2`**: the default set adds bzip2, xz and zstd, each of which links a C
library every image copying this binary would then need, and an upload is
gzipped or plain. `flate2` resolves to the pure-Rust `miniz_oxide`, so the
binary links nothing but glibc, which is why the create-sample runtime stage
installs nothing at all.

`clap`, `serde`/`serde_json` and `thiserror` are the remaining dependencies.

## Commands

Run from this directory.

| Command | Action |
| --- | --- |
| `cargo test` | Unit tests, the FastQC goldens, and the rounding corpus |
| `cargo clippy --all-targets -- -D warnings` | Lint |
| `cargo fmt` | Format |
