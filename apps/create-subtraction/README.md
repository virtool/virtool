# @virtool/create-subtraction

The first workflow executor: a one-shot process that starts, works, exits. It
ports Python's `create_subtraction` workflow, which turns an uploaded FASTA into
a subtraction a sample analysis can be run against.

Image: `ghcr.io/virtool/ts-create-subtraction`.

Only its object-storage half is wired so far; claiming a job arrives with the
workflow runtime core.

## Ported without `build_index`

Python's workflow has four steps — decompress the source FASTA, compute `gc` and
`count`, build a bowtie2 index, then compress the FASTA, upload it alongside
`bowtie_index_path.glob("*.bt2")` and finalize. **The port drops the third step
and that glob**, and the decision is settled rather than pending.

Nothing consumes the shards. Both analysis workflows build a subtraction's
bowtie2 index locally from the `.fa.gz` and memoize it through their own
workflow cache, and `WFSubtraction.bowtie2_index_path` is defined and never
read — so the shards are written by one workflow and read by none. The jobs
API's `PATCH /subtractions/{id}` whitelists `subtraction.fa.gz` and nothing
else, so a manifest carrying a shard is refused: a port that kept the step could
not finalize.

What is left runs **no external process**. `decompressFile`, `compressFile` and
`isGzipped` in `@virtool/workflow`'s `files/` deliberately do not shell out to
`pigz` — they are `node:zlib` streams, because Python's `pigz` branch exists for
parallelism and checksums are taken over decompressed content, so the gzip bytes
need not match. The `gc`/`count` step is a scan over the decompressed FASTA.
Transfers are `downloadToPath` / `uploadFromPath` against the storage backend.

So the runtime stage copies nothing from `ghcr.io/virtool/tools`. Reintroducing
a step that shells out to a tool means adding that `COPY --from` line, and the
shared libraries and interpreters the binary needs alongside it.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/create-subtraction build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-subtraction start` | Run the bundle |
| `pnpm --filter @virtool/create-subtraction typecheck` | `tsc --noEmit` |

## Documentation

`docs/workflow-runtime.md` covers the runtime every executor runs on — the step
model, the eager context, cancellation, the subprocess runner and the config
table. `docs/apps.md` covers the bundling and `pnpm deploy` pipeline every
non-Vite app shares, and `docs/images.md` the image pipeline.
