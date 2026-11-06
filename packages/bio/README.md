# `@virtool/bio`

Sequence utilities (complement, translation, ORF finding, FASTA and FASTQ) and
the pure text parsers that workflows need.

- Import sequence utilities from `@virtool/bio/bio`.
- Import the `hmmscan --tblout` parser from `@virtool/bio/hmmer`.
- Import paired-end quality averaging from `@virtool/bio/fastqc`.
- Import Illumina run identity parsers from `@virtool/bio/illumina`.

Output must match data that Virtool stored earlier, including its quirks. A
failing golden test is a finding, not a test to re-baseline.

## Commands

Run from the monorepo root.

| Command                                | Action                  |
| -------------------------------------- | ----------------------- |
| `pnpm --filter @virtool/bio test`      | Run tests.              |
| `pnpm --filter @virtool/bio typecheck` | Type-check the package. |
