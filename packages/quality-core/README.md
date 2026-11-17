# quality-core

Read quality statistics for one FASTQ file, built as a standalone
command-line binary that
[`@virtool/create-sample`](../../apps/create-sample/README.md) runs as a
subprocess. It replaced FastQC 0.11.9 in that workflow.

One of two Rust crates here. The other is
[`pathoscope-core`](../pathoscope-core/README.md). Neither crate is a pnpm
workspace member, so `pnpm test` does not run them. Run `cargo` in this
directory. CI runs them in the `quality-test` job.

```
quality-core --input reads_1.fq.gz --output quality.json
```

The input is gzipped or plain FASTQ. The binary writes the results to
`--output` and never to stdout.

## Output matches FastQC

The statistics are FastQC's, not the textbook ones. Stored samples hold blobs
that FastQC computed, so a more correct statistic would diverge from stored
data.

One difference is deliberate. This crate reports every cycle. FastQC averages
groups of positions when reads are longer than 75bp. The shape is the same, so
stored data needs no backfill. The per-cycle data is finer.

## Commands

Run from this directory.

| Command                                     | Action                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| `cargo test`                                | Unit tests, the FastQC goldens, and the rounding corpus |
| `cargo clippy --all-targets -- -D warnings` | Lint                                                    |
| `cargo fmt`                                 | Format                                                  |
