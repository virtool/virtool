# Indexes

## SQLite artifact

A reference index is stored as one gzip-encoded SQLite file. A workflow
stream-decompresses it to a transient raw SQLite path before `packages/sqlite/`
opens it.

Three names, one SQLite format:

| Name | Written by | Holds |
| --- | --- | --- |
| `reference-snapshot.v1.sqlite.gz` | a finished index build, in storage | a whole reference |
| `reference-snapshot.v1.sqlite` | a build or workflow, transiently | the raw SQLite prerequisite/working file |
| `index.v1.sqlite` | a workflow, locally | whatever survived a step |

The names are deliberately distinct. Pathoscope's collapsed reference is missing
every isolate `cd-hit-est` dropped, and one name for both is how a partial
artifact ends up uploaded as a whole reference. Both carry
`format = virtool-reference-sqlite` and `format_version = 1` in their `metadata`
table, which `openIndexArtifact` checks before a run reads a row.

### Measurements

When measured on a synthetic 300 MB artifact containing 20,000 OTUs and 60,000
sequences of 5 kb, scanning the whole index to a 287 MB FASTA didn't increase
peak RSS: it was 87 MB before and after. Using `.all()` on any query in
`queries.ts` undoes that.

The bulk-load transaction (`createIndexArtifact` in `create.ts`), same
artifact, same machine:

| Path | Time |
| --- | --- |
| Raw prepared statements, one transaction | **0.5 s** |
| Raw prepared statements, autocommit | ~146 s (projected from 2,000 OTUs) |

Outside a transaction SQLite commits per statement, which is one fsync per
sequence row. Reads on the same artifact: 1.4 s to write the full FASTA and
0.6 s to scan every OTU document.
