# @virtool/pathoscope

The pathoscope workflow executor. Pathoscope quantifies known viruses in a
sample: it collapses redundant isolates out of the reference, maps the sample
against one representative per OTU to find candidates, rebuilds an index
carrying every isolate of just those OTUs, maps again, drops reads that belong
to the host, and reassigns the reads that matched more than one isolate.

Image: `ghcr.io/virtool/ts-pathoscope`. Eight steps, four external
tools — `bowtie2`, `cd-hit-est`, `pigz`, `samtools` — and `pathoscope-core`,
which it drives **as a subprocess**; there is no FFI here and adding one is out
of scope by decision.

## Two rules it carries

- **It writes no result file.** Python uploaded a `report.tsv` whose every
  figure is already in the `results` blob, so the finalize manifest is empty and
  `FinalizeAnalysisRequest.files` allows that for this workflow's sake.
- **Nothing deletes an analysis on failure.** Python's `on_failure` hook is not
  ported and the jobs API has no delete route.

## Building the image

Its stages in the root `Dockerfile` are a cargo-chef build of
`packages/pathoscope-core`, a Node build on the shared `base`, and a runtime
layering the `bowtie2`, `cd-hit`, `pigz` and `samtools` tool stages over both:

```
docker build --target pathoscope .
```

### The runtime stage installs interpreters, not just libraries

Two of the four tools are scripts, not ELF binaries, and `node:24-bookworm-slim`
carries neither interpreter in full:

| Tool | Shebang | Needs |
| --- | --- | --- |
| `bowtie2` | `#!/usr/bin/env perl` | full `perl` — the slim base ships `perl-base`, which omits `Sys::Hostname` |
| `bowtie2-build` | `#!/usr/bin/env python3` | `python3` with the stdlib — `python3-minimal` omits it and the script dies on `import gzip` |

`bowtie2-build` is the wrapper that picks between the real `bowtie2-build-s` and
`bowtie2-build-l` by index size. Calling those directly and porting bowtie2's own
size heuristic is the alternative to shipping python3, and it belongs here rather
than in a shared base if it is ever taken.

The shared libraries each back a specific `ldd ... => not found`: `libgomp1` for
bowtie2's OpenMP, `libcurl4` and `libncursesw6` for samtools. `pathoscope-core`
needs none of them — `hts-sys` links htslib statically.

A missing interpreter does not fail the build; it fails the first time the step
runs in a pod. Verify a shebang against the version the `Dockerfile` pins, never
upstream's current source:

```
docker build --target bowtie2 -t vt-tool-bowtie2 .
docker run --rm vt-tool-bowtie2 head -1 /tools/bowtie2/2.5.4/bowtie2-build
```

### Publishing

**CI builds it but must not publish it.** `virtool/workflow-pathoscope` still
releases the pathoscope workflow, and a second pipeline shipping it from here
would leave two candidates for what the cluster runs. Don't add a publish job
until that repo retires — note that `publish-ghcr` is also what stamps a real
version, so until then `APP_VERSION` is `0.0.0` in every built image, and the
`workflow_version` in its cache keys with it.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/pathoscope build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/pathoscope start` | Run the bundle |
| `pnpm --filter @virtool/pathoscope test` | Run the Vitest suite |
| `pnpm --filter @virtool/pathoscope test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/pathoscope typecheck` | `tsc --noEmit` |

The Rust crate is not a pnpm workspace — run `cargo test` in
`packages/pathoscope-core` directly. Building it needs `libclang-dev`.

## Documentation

`docs/workflow-runtime.md` covers the runtime every executor runs on,
[`packages/pathoscope-core/README.md`](../../packages/pathoscope-core/README.md)
the Rust crate, `docs/index-artifact.md` the SQLite reference index it reads,
`docs/apps.md` the bundling and `pnpm deploy` pipeline every non-Vite app
shares, and `docs/images.md` the image pipeline.
