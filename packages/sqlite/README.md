# `@virtool/sqlite`

The reference index SQLite artifact: its schema, the reads a workflow makes
against one, and the writer that produces one.

Four modules, all exported from the package root:

| Module | What it holds |
| --- | --- |
| `schema.ts` | the schema, the filename and format constants, `openIndexArtifact`, `createIndexArtifactSchema` |
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
`@virtool/data` would drag execa, undici and tar-stream into `apps/internal`,
and a second copy of the DDL in the data package would be two
opinions about one binary format.

## This package specifies the format

The artifact format is specified here, and what is specified is the *schema* —
columns, constraints and indexes — not any particular DDL text. The tables are
declared explicitly and never reflected, so only the schema itself binds a
writer.

The rules that shape the modules are documented as JSDoc on the code, not
repeated here: `queries.ts`'s module comment covers why ordering is pinned and
why nothing materialises the index, `schema.ts`'s `openIndexArtifact` covers
the no-fallback rule, and `errors.ts` covers what each failure means.

`src/fixtures/` holds a reference artifact plus the golden results of every
query, captured from the Python server the reader is pinned to. The script that
wrote them is gone, and there is no supported way to regenerate them from this
package — `git log --diff-filter=D` under `src/fixtures/` finds it if it is
wanted. **Never edit a golden to match this implementation's output** — that
converts a caught divergence into a permanent one.

See [docs/references.md](../../docs/references.md) for the measurements
behind the streaming and bulk-load decisions.
