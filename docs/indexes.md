# Indexes 

## SQLite Artifact
A reference index reaches a workflow as one SQLite file,
`virtool-index-sqlite-v1.sqlite`, built by Python's
`virtool/workflow/data/index_sqlite.py`. `packages/workflow/src/index/` reads it,
and writes the one case a workflow has to produce itself.

Three modules, all exported from `@virtool/workflow`:

| Module | What it holds |
| --- | --- |
| `index/schema.ts` | the schema mirror, the filename and format constants, `openIndexArtifact`, `createIndexArtifactSchema` |
| `index/queries.ts` | `openWorkflowIndex` and the six reads, plus `writeFasta` |
| `index/create.ts` | `createIndexArtifact`, the bulk load |

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
