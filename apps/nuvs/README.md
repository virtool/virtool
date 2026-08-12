# @virtool/nuvs

The NuVs workflow executor. NuVs finds viruses the reference does **not**
describe: it discards every read that maps to a known OTU or to a
subtraction, assembles what is left with SPAdes, and searches the contigs for
viral motifs with HMMER.

Image: `ghcr.io/virtool/ts-nuvs`. Ten steps, five external tools — `skewer`,
`bowtie2`, SPAdes, `hmmpress` and `hmmscan`.

## Five rules it carries

- **SPAdes 4.2.0 is compiled from source**, because no binary release fits the
  base, and the runtime installs `python3` for it — `spades.py` is a Python
  script driving the compiled assembler binaries.
- **The raw `results` shape is pinned by `formatNuvs`**
  (`packages/data/src/analyses/format.ts`), *not* by
  `packages/contracts/src/nuvs.ts`, which describes the **formatted**
  envelope. The workflow writes each ORF hit's `hit` (an annotation id) and
  never `cluster`, `families` or `names`, which the server merges in from the
  `hmms` table.
- **A sample with no quality data fails in `buildContext`**, because
  `max_length` is `quality.length[1]` and Python instead compares `None` with
  an `int` two steps in.
- **Python's `hits.remove(sequence)` branch in `vfam` is unreachable** and is
  deliberately not ported — porting it as though it fires would renumber the
  contigs and invalidate every stored index.
- **Nothing deletes an analysis on failure**, as with pathoscope.

It reads `hmm/profiles.hmm` and `hmm/annotations.json.gz` straight from
storage — there is no jobs API HMM route — and checks both keys before step
one. The annotations blob is written lazily by Python, on the first request
for it, and cleared whenever an HMM install commits, so it is cold on a fresh
install and a run says so by name rather than failing at `vfam`.

## Building the image

Its stages in the root `Dockerfile` are a from-source SPAdes compile, a Node
build on the shared `base`, and a runtime layering the
`ghcr.io/virtool/tools` binaries and the compiled SPAdes over both:

```
docker build --target nuvs .
```

### The runtime stage installs interpreters, not just libraries

`node:24-bookworm-slim` carries neither in full:

| Tool | Needs |
| --- | --- |
| `bowtie2` | full `perl` and `libgomp1` for its OpenMP-compiled binaries |
| SPAdes (`spades.py`) | `python3` with the stdlib, and `libbz2-1.0` |

There is deliberately no `pigz` in the runtime: `@virtool/workflow`'s gzip
helpers are `node:zlib` in-process, and checksums are taken over decompressed
content, so nothing depends on `pigz`'s output.

### Publishing

**CI builds it but must not publish it.** `virtool/workflow-nuvs` still
releases the NuVs workflow, and a second pipeline shipping it from here would
leave two candidates for what the cluster runs. Don't add a publish job until
that repo retires — note that `publish-ghcr` is also what stamps a real
version, so until then `APP_VERSION` is `0.0.0` in every built image, and the
`workflow_version` in its cache keys with it.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/nuvs build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/nuvs start` | Run the bundle |
| `pnpm --filter @virtool/nuvs test` | Run the Vitest suite |
| `pnpm --filter @virtool/nuvs test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/nuvs typecheck` | `tsc --noEmit` |

## Documentation

`docs/workflow-runtime.md` covers the runtime every executor runs on,
`docs/index-artifact.md` the SQLite reference index it reads, `docs/apps.md`
the bundling and `pnpm deploy` pipeline every non-Vite app shares, and
`docs/images.md` the image pipeline.
