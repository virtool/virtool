# @virtool/create-subtraction

Image: `ghcr.io/virtool/create-subtraction`.

Computes GC and sequence count for a subtraction and commits its FASTA to
object storage. The image needs two external tools: `seqkit` and `pigz`.

## Building the image

```console
docker buildx bake -f packages/image-build/docker-bake.hcl create-subtraction
```

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the environment variables and configuration rules.

## Commands

Run from the monorepo root.

| Command                                               | Action                     |
| ----------------------------------------------------- | -------------------------- |
| `pnpm --filter @virtool/create-subtraction build`     | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-subtraction start`     | Run the bundle             |
| `pnpm --filter @virtool/create-subtraction test`      | Vitest                     |
| `pnpm --filter @virtool/create-subtraction typecheck` | `tsc --noEmit`             |
