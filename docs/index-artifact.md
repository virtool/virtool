# The reference index artifact

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

## Why it is not JSON

The index used to ship as `reference-v2.json.gz`. A real reference decompresses
to 200–500 MB of JSON, and `JSON.parse` cannot return a string that large —
V8 caps a string at roughly 512 MB on 64-bit, and the parse allocates the whole
document besides. SQLite is read incrementally, so size stops being the
constraint.

## `node:sqlite`, and no ORM

The reader uses Node's built-in `node:sqlite` directly, with hand-written SQL.
There is no Drizzle here, and that is a departure from the plan the work started
from.

Drizzle ships no `node:sqlite` driver. Its SQLite dialects are `better-sqlite3`,
`bun-sqlite`, `durable-sqlite`, `expo-sqlite`, `op-sqlite` and `sqlite-proxy`,
and none of the three that could apply survives contact with this problem:

- **`sqlite-proxy`** hands a callback every row of a query at once. That
  materialises the index, which is the single thing this module exists to avoid.
  Paging around it with `LIMIT`/`OFFSET` over the three-way join degrades
  quadratically.
- **`better-sqlite3`** is a native dependency. It would need externals wiring in
  every workflow app's bundle and a compile toolchain in the image, to buy an
  ORM over six fixed queries.
- **Drizzle for SQL generation only**, executed through `node:sqlite`, keeps the
  type inference but adds a fake driver and still writes the nested-JSON query
  as a raw `sql` escape hatch.

Against that, the schema is read-only, Python owns every migration, and there is
nothing to generate. `node:sqlite` needs no dependency at all: it is present and
unflagged on Node 22.23 and Node 24, which is CI and the workflow images
respectively. Both emit an `ExperimentalWarning` on first import; nothing else
differs.

## Ordering is the output

The order sequences come back in is the order of the FASTA records, which is the
order of the Bowtie2 index, which is the order of every SAM line mapped against
it. A reader that returns Python's rows in a different order produces an
analysis that does not reproduce Python's, so ordering is pinned, not assumed.

Three of the queries carry a real `ORDER BY`, copied from `indexes.py`:

| Query | Order |
| --- | --- |
| `iterSequences` | `sequences.id` |
| `iterDefaultSequences` | `isolates.otu_id, isolates.virtool_id, sequences.id` |
| `iterOtuSequences` | `isolates.otu_id, isolates.virtool_id, sequences.id` |

### `iterOtus` orders by nothing, and that is deliberate

`iterOtus` assembles its nested document with `json_object` and
`json_group_array` in correlated scalar subqueries, the same shape Python uses.
Each of those subqueries ends in an `ORDER BY` — and **every one of them is a
no-op**.

SQLite applies an `ORDER BY` to the rows a query returns. An aggregate with no
`GROUP BY` returns exactly one row, so the clause sorts a single row and the
aggregation itself consumes whatever the scan yields. With
`isolates_otu_id_idx` and `sequences_isolate_id_idx` in place, that is rowid
order — insertion order — not id order. The fixture proves it: `iso_b` was
inserted before `iso_a` and comes back first, and its sequences come back
`seq_b2, seq_b1`.

Python has the same clauses and the same no-op, so its OTU documents have always
been in insertion order. This is a quirk to reproduce, not to fix. Pathoscope
feeds these sequences to `cd-hit-est`, which picks a cluster representative by
the order it sees them in, so a "corrected" sort would change which isolates
survive collapsing and change the analysis. The clauses stay in the TypeScript
query for the same reason: removing them could change the query plan, and the
plan is what decides the order.

Fixing this means changing Python, the artifact and this reader together.

## Nothing materialises the index

Every iterating query is an async generator over `StatementSync.iterate()`. It
yields to the event loop every 500 sequence rows, or every OTU document —
Python's `_SQLITE_SEQUENCE_BATCH_SIZE` and `_SQLITE_OTU_BATCH_SIZE`. Python
batches that way to hand a cursor partition to a worker thread; `node:sqlite` is
synchronous and there is no thread to move the scan to, so here the batch size
decides how long the loop is blocked. That matters because the ping loop is what
keeps the job from being swept as stalled while a long scan runs.

`writeFasta` streams through `pipeline`, so the scan is paced by how fast the
disk takes the bytes.

Measured on a synthetic 300 MB artifact — 20,000 OTUs, 60,000 sequences of
5 kb — scanning the whole index to a 287 MB FASTA moved peak RSS not at all:
87 MB before and 87 MB after. Reaching for `.all()` on any of these queries
undoes that.

`getOtuRefsBySequenceIds` and `iterOtuSequences` bind their id sets as one JSON
array through `json_each`, not as one `?` per id. `IN (?, ?, …)` would cap the
callable set at SQLite's variable limit, and chunking around that limit is not
open to the sequence queries — each chunk would be sorted on its own and the
concatenation would not be in Python's order.

## The write half

Pathoscope collapses the reference it is given — `cd-hit-est` drops
near-duplicate isolates — and writes the survivors as a second artifact it reads
back through `openWorkflowIndex`. So the write path is required, not optional,
and what it writes has to be a file Python's reader accepts too, because the two
implementations run side by side during the port.

`createIndexArtifact` consumes an `Iterable` or `AsyncIterable` of OTU documents
lazily and runs the whole load in one transaction, rolling back and leaving no
partial artifact if a row fails.

### Bulk-load measurement

The plan called for measuring Drizzle's inserts against raw prepared statements.
With no Drizzle driver in play the live question became the transaction, and it
is the whole performance story. Same 300 MB artifact, same machine:

| Path | Time |
| --- | --- |
| Raw prepared statements, one transaction | **0.5 s** |
| Raw prepared statements, autocommit | ~146 s (projected from 2,000 OTUs) |
| Python's `create_index_sqlite` | ~3 s (projected from 2,000 OTUs) |

Outside a transaction SQLite commits per statement, which is one fsync per
sequence row. Reads on the same artifact: 1.4 s to write the full FASTA, 0.6 s
to scan every OTU document, against ~5 s for Python's FASTA scan.

## The fixture is generated by Python

`src/index/fixtures/` holds an artifact Python built, the golden results of
every query against it, and the FASTA Python wrote from it.
`fixtures/generate.py` is the provenance record — it is not run by CI, and it
runs against a checkout of the Python server:

```
cd /path/to/virtool
.venv/bin/python /path/to/virtool-ui/packages/workflow/src/index/fixtures/generate.py
```

The fixture's OTUs, isolates, schema items and sequences are deliberately
supplied in an order that does not match the order the queries must return them
in, so a reader that leaks insertion order where it should sort — or sorts where
Python does not — fails rather than passing by coincidence.

**Never edit `golden.json` or `default.fa` to match this implementation's
output.** They are what Python produced. Editing one to make a test pass
converts a caught divergence into a permanent one. If a golden is wrong, the
fixture is regenerated from Python, and the diff is the finding.

## Failures are named, and there is no fallback

An index whose artifact cannot be read cannot be analysed. There is deliberately
no degradation to another source — a run that quietly fell back would produce
results nothing could reproduce.

| Error | Raised when |
| --- | --- |
| `IndexArtifactMissingError` | the file is absent, truncated, or not a database |
| `IndexArtifactFormatError` | `metadata` is unreadable, or names a format or version this reader does not understand |
| `IndexReferenceNotFoundError` | the artifact holds no reference row |
| `IndexSequenceNotFoundError` | `getOtuRefsBySequenceIds` was given an id the artifact has no sequence for |
| `IndexOtuIntegrityError` | an OTU has no isolates, or an isolate has no sequences |

`IndexArtifactMissingError` names the index id and, when the caller supplied
one, the storage key — the two failures behind it, an artifact that was never
built and a download that silently wrote nothing, are told apart by looking that
key up in the bucket. `IndexArtifactFormatError` names both what was expected
and what was found, because a version bump on Python's side is the likely cause
and the found value is what says which one.

`DatabaseSync` opens lazily, so `openIndexArtifact` forces a read against
`sqlite_master` immediately. Without it a truncated download constructs cleanly
and fails much later, as a query error rather than an open error.
