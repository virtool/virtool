# Indexes

## SQLite Artifact

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

Four modules, all exported from `@virtool/sqlite`:

| Module | What it holds |
| --- | --- |
| `schema.ts` | the schema mirror, the filename and format constants, `openIndexArtifact`, `createIndexArtifactSchema` |
| `queries.ts` | `openWorkflowIndex` and the six reads, plus `writeFasta` |
| `create.ts` | `createIndexArtifact`, the bulk load |
| `errors.ts` | `IndexArtifactError` and the five failures a caller can tell apart |

The rules that shape those modules — why ordering is pinned to Python's, why
nothing materialises the index, and what each error means — are documented as
JSDoc on the code itself, not repeated here: `queries.ts`'s module comment and
the `SELECT_OTUS`/`checkOtu` comments cover ordering and streaming;
`schema.ts`'s `openIndexArtifact` covers the no-fallback rule; `errors.ts`'s
`Index*Error` classes cover what each failure means and when it fires. Read
there first — this file holds only what isn't already on the code: the
measurements behind those decisions.

### Measurements

Measured on a synthetic 300 MB artifact — 20,000 OTUs, 60,000 sequences of
5 kb — scanning the whole index to a 287 MB FASTA moved peak RSS not at all:
87 MB before and 87 MB after. Reaching for `.all()` on any of the queries in
`queries.ts` undoes that.

The bulk-load transaction (`createIndexArtifact` in `create.ts`), same
artifact, same machine:

| Path | Time |
| --- | --- |
| Raw prepared statements, one transaction | **0.5 s** |
| Raw prepared statements, autocommit | ~146 s (projected from 2,000 OTUs) |
| Python's `create_index_sqlite` | ~3 s (projected from 2,000 OTUs) |

Outside a transaction SQLite commits per statement, which is one fsync per
sequence row. Reads on the same artifact: 1.4 s to write the full FASTA, 0.6 s
to scan every OTU document, against ~5 s for Python's FASTA scan.
