# @virtool/pathoscope

The pathoscope workflow executor. Pathoscope quantifies known viruses in a
sample: it collapses redundant isolates out of the reference, maps the sample
against one representative per OTU to find candidates, rebuilds an index
carrying every isolate of just those OTUs, maps again, drops reads that belong
to the host, and reassigns the reads that matched more than one isolate.

Image: `ghcr.io/virtool/pathoscope`. Eight steps, four external
tools: `bowtie2`, `cd-hit-est`, `pigz`, and `samtools`. It also runs
`pathoscope-core` as a subprocess.

## Behavior

The workflow writes no result file, and nothing deletes an analysis when a run
fails. A failed run leaves its half-built analysis for the user to delete.

## Building the image

The shared workflow-tools Dockerfile builds `pathoscope-core`, Bowtie 2,
CD-HIT, and samtools. The app Dockerfile layers them into the runtime, with
`pigz` from apt:

```
docker buildx bake -f packages/image-build/docker-bake.hcl pathoscope
```

### Publishing

`Pathoscope / Build` compiles the image on every run. `release-ghcr` publishes
it to `ghcr.io/virtool/pathoscope` on release.

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the complete environment-variable table and configuration rules.

## Commands

Run from the monorepo root.

| Command                                        | Action                     |
| ---------------------------------------------- | -------------------------- |
| `pnpm --filter @virtool/pathoscope build`      | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/pathoscope start`      | Run the bundle             |
| `pnpm --filter @virtool/pathoscope test`       | Run the Vitest suite       |
| `pnpm --filter @virtool/pathoscope test:watch` | Vitest in watch mode       |
| `pnpm --filter @virtool/pathoscope typecheck`  | `tsc --noEmit`             |

`pnpm` does not run the Rust crate's tests. See the crate README.

## Documentation

See the [workflow package README](../../packages/workflow/README.md) for the
runtime every executor uses, the
[`pathoscope-core` README](../../packages/pathoscope-core/README.md) for the
Rust crate, and [Images](../../README.md#images) for the shared image pipeline.
