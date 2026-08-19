# @virtool/create-subtraction

Image: `ghcr.io/virtool/create-subtraction`.

Computes GC and sequence count for a subtraction and commits its
FASTA to object storage.

Two steps, `compute_gc_and_count` and `finalize`, and one external tool,
`seqkit`.

## Building the image

The root Dockerfile builds SeqKit in its own stage and copies its binary into
this app's runtime stage:

```console
docker build --target create-subtraction .
```

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the complete environment-variable table and configuration rules.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/create-subtraction build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-subtraction start` | Run the bundle |
| `pnpm --filter @virtool/create-subtraction test` | Vitest |
| `pnpm --filter @virtool/create-subtraction typecheck` | `tsc --noEmit` |
