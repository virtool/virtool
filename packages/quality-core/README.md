# quality-core

Read quality statistics for one FASTQ file, built as a standalone
command-line binary that
[`@virtool/create-sample`](../../apps/create-sample/README.md) invokes as a
subprocess. It replaced FastQC 0.11.9 in that workflow.

One of two Rust crates here; the other is
[`pathoscope-core`](../pathoscope-core/README.md). Neither is a pnpm workspace
member, so `pnpm test` does not reach them — run `cargo` in this directory, and
CI gates it with a `quality-test` job.

```
quality-core --input reads_1.fq.gz --output quality.json
```

One invocation, one file, one blob. Gzipped or plain; the results go to
`--output` and never to stdout, because the workflow runtime opens a
subprocess's stdout on `/dev/null` unless it is given a handler.

## It computes FastQC's statistics, not the textbook ones

The output is the seven fields of the `Quality` object in
`packages/contracts/src/samples.ts` — what `legacy_samples.quality` holds and
every chart in the SPA reads. Nothing else FastQC produces came across: no HTML
report, no adapter content, no duplication estimate, no pass/warn/fail.

None of the definitions is the obvious one, and each is ported from a named
Java file:

| Field | FastQC source | The part that surprises |
| --- | --- | --- |
| `bases` | `PerBaseQualityScores.java`, `QualityCount.java` | Percentiles are a cumulative walk over an integer histogram, not an interpolation, so every one is a whole number |
| `composition` | `PerBaseSequenceContent.java` | The denominator is A+C+G+T, so `N` is excluded from it |
| `count`, `gc`, `length`, `encoding` | `BasicStats.java` | `%GC` is *integer* division and has already lost its fraction |
| `sequences` | `PerSequenceQualityScores.java` | The per-read mean truncates the summed **raw** characters, before the offset comes off |

Two more that are easy to miss:

- **The encoding is decided by the single lowest quality character in the whole
  file**, and that decision sets the offset every score in the blob is measured
  against. A file of nothing but high scores reads as Illumina, not Sanger.
- **A cycle covered by 100 reads or fewer has no percentiles.** FastQC reports
  `NaN` for all five, which cannot be stored — not valid JSON, and rejected by
  both the JSONB column and the `Quality` schema — so the row is resolved by
  substituting the first value in it that is a real number, the mean, for the
  whole row. It is not a rare shape: a file of variable-length reads thins out
  toward its longest read.

**Do not "correct" any of these.** The blob is compared against the ones
samples already hold, and a more defensible statistic is a divergence in stored
data.

## One divergence is deliberate: no binning

FastQC groups base positions once the longest read passes **75bp**, reporting
one averaged row per group and repeating it across the group's members — so a
stored blob from a 301bp run holds runs of five identical rows. This crate
reports every cycle.

The shape is unchanged, so nothing needs a backfill and no chart changes; the
data is simply finer. For reads of 75bp or less there is no divergence at all.

`tests/fastqc.rs` pins the difference rather than tolerating it: for a binned
case it asserts that the five non-per-cycle fields are identical, that the row
count is identical, that positions 1-9 (which FastQC leaves ungrouped at any
length) are identical, and that **every grouped row is the mean of the cycles
this crate reports for it** — which is what makes the finer data a refinement
of the coarser one rather than a different measurement.

## The goldens come from FastQC, and must keep coming from FastQC

`tests/fixtures/*.json` are blobs derived from real FastQC 0.11.9 reports, and
the field table above records exactly how each one maps onto `Quality`. They
are frozen references. **Never edit a golden to make a failing comparison
pass**, and never regenerate one from this crate. That converts a caught
divergence into a permanent one, and leaves a test that asserts only that the
code still does what it did.

There is no script here that writes them and no supported way to regenerate
one. If a golden is ever found to be wrong, re-derive it from FastQC itself:
install FastQC 0.11.9 (a JRE and the full `perl`, not `perl-base` — its
launcher opens with `use FindBin`), run it over the input with `-f fastq
--extract`, and work the expected `quality` and `baseGroups` out of the raw
report by hand against the field table above, rather than trusting any parser
to do it.

The inputs are synthetic and are committed alongside the goldens, so nothing
has to be reconstructed to do this. The script that first produced all of it
was deleted once the goldens were committed; `git log --diff-filter=D` under
this directory finds it if it is wanted as a starting point.

Four cases, each reaching a specific branch rather than being a slice of a real
run, which would reach whichever ones it happened to:

| Case | What it is for |
| --- | --- |
| `unbinned` | 400 reads of exactly 75bp — the deepest comparison possible cycle for cycle. Exact equality |
| `variable` | Plain input, lengths of 30/55/75, tail cycles covered by exactly 100 reads then 40 — the row-collapse rule. Exact equality |
| `all_n` | One cycle where every read is `N` — the zero-denominator rule. Exact equality |
| `binned` | 400 reads of 150bp — the one deliberate divergence |

`tests/fixtures/rounding.jsonl` is a separate corpus, 2,058 cases of
`{value, digits, expected}` where `expected` is `value` rounded half to even at
`digits` places, on the exact binary value of the double. It pins
`round_half_even` on every value the blob can hold, and the TypeScript
`roundHalfEven` in `packages/bio` must agree with it figure for figure. It is
frozen on the same terms as the goldens above.

## Dependencies stay small

`needletail` for FASTQ parsing, with **`default-features = false` and only
`flate2`**: the default set adds bzip2, xz and zstd, each of which links a C
library every image copying this binary would then need, and an upload is
gzipped or plain. `flate2` resolves to the pure-Rust `miniz_oxide`, so the
binary links nothing but glibc, which is why the create-sample runtime stage
installs nothing at all.

`clap`, `serde`/`serde_json` and `thiserror` are the rest. There is no
`libclang` requirement here — that is `pathoscope-core`'s `hts-sys`.

## Commands

Run from this directory.

| Command | Action |
| --- | --- |
| `cargo test` | Unit tests, the FastQC goldens and the rounding corpus |
| `cargo clippy --all-targets -- -D warnings` | Lint |
| `cargo fmt` | Format |
