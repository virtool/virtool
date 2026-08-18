# `@virtool/sqlite`

The reference index SQLite artifact: its schema, the reads a workflow makes
against one, and the writer that produces one.

Four modules, all exported from the package root:

| Module | What it holds |
| --- | --- |
| `schema.ts` | the schema mirror, the filename and format constants, `openIndexArtifact`, `createIndexArtifactSchema` |
| `queries.ts` | `openWorkflowIndex` and the six reads, plus `writeFasta` |
| `create.ts` | `createIndexArtifact`, the bulk load |
| `errors.ts` | `IndexArtifactError` and the five failures a caller can tell apart |

Nothing here touches the network or the database, and it constructs nothing at
import time. `node:sqlite` and the filesystem are its whole dependency surface —
there are no runtime dependencies at all, workspace ones included.

## Two callers, one artifact format

An index is built by the server and read by a workflow, so both sides need this
package:

- **`@virtool/data`** writes a transient `reference-snapshot.v1.sqlite` and
  publishes it as `reference-snapshot.v1.sqlite.gz` from the `create_index`
  task.
- **The workflow executors** stream-decompress that snapshot back to the raw
  filename before opening it. Pathoscope also *writes* one:
  `cd-hit-est` collapses the reference it was given, and the survivors go into
  `index.v1.sqlite`, which later steps reopen through `openWorkflowIndex`.

The two names are not interchangeable and the constants are separate for that
reason — a collapsed reference is missing every isolate `cd-hit-est` dropped,
and one name for both is how a partial artifact gets uploaded as a whole one.

That second caller is why this is a package rather than part of
`@virtool/workflow`, where it used to live. A workflow-runtime dependency in
`@virtool/data` would drag execa, undici and tar-stream into `apps/tasks` and
the jobs API, and a second copy of the DDL in the data package would be two
opinions about a binary format two languages have to agree on.

## The format is Python's, and this is a mirror of it

Python writes and reads the same artifact, and both implementations are live
until the port completes. The mirror is of the *schema* — columns, constraints
and indexes — not of SQLAlchemy's DDL text; Python declares its tables
explicitly and never reflects them.

The rules that shape the modules are documented as JSDoc on the code, not
repeated here: `queries.ts`'s module comment covers why ordering is pinned to
Python's and why nothing materialises the index, `schema.ts`'s
`openIndexArtifact` covers the no-fallback rule, and `errors.ts` covers what
each failure means.

`src/fixtures/` holds an artifact Python built plus the golden results of every
query, and `generate.py` is the provenance record. **Never edit a golden to
match this implementation's output** — that converts a caught divergence into a
permanent one.

See [docs/indexes.md](../../docs/indexes.md) for the measurements
behind the streaming and bulk-load decisions.
