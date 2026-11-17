# @virtool/nuvs

Nuvs finds viruses the reference does not
describe: it discards every read that maps to a known OTU or to a
subtraction, assembles what's left with SPAdes, and searches the contigs for
viral motifs with HMMER.

Image: `ghcr.io/virtool/nuvs`. Ten steps use six external tools: `skewer`,
`bowtie2`, SPAdes, `hmmpress`, `hmmscan` and `pigz`.

## Building the image

The shared workflow-tools Dockerfile builds each external tool independently.
The app Dockerfile layers them into the runtime.

```console
docker buildx bake -f packages/image-build/docker-bake.hcl nuvs
```

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the complete environment-variable table and configuration rules.

## Commands

Run from the monorepo root.

| Command                                  | Action                     |
| ---------------------------------------- | -------------------------- |
| `pnpm --filter @virtool/nuvs build`      | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/nuvs start`      | Run the bundle             |
| `pnpm --filter @virtool/nuvs test`       | Run the Vitest suite       |
| `pnpm --filter @virtool/nuvs test:watch` | Vitest in watch mode       |
| `pnpm --filter @virtool/nuvs typecheck`  | `tsc --noEmit`             |
