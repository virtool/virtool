# @virtool/create-subtraction

Image: `ghcr.io/virtool/ts-create-subtraction`.

Computes GC and sequence count for a subtraction and commits it's 
FASTA to object storage.

Two steps, `compute_gc_and_count` and `finalize`, and one external tool,
`seqkit`.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/create-subtraction build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-subtraction start` | Run the bundle |
| `pnpm --filter @virtool/create-subtraction test` | Vitest |
| `pnpm --filter @virtool/create-subtraction typecheck` | `tsc --noEmit` |

