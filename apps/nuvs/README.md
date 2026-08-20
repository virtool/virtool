# @virtool/nuvs

NuVs finds viruses the reference does **not**
describe: it discards every read that maps to a known OTU or to a
subtraction, assembles what is left with SPAdes, and searches the contigs for
viral motifs with HMMER.

Image: `ghcr.io/virtool/nuvs`. Ten steps, six external tools — `skewer`,
`bowtie2`, SPAdes, `hmmpress`, `hmmscan` and `pigz`.

## Building the image

The root Dockerfile builds each external tool in an independent stage. SPAdes
4.2.0 is compiled from source because it has no binary release suitable for
the runtime base. The runtime installs Perl for the Bowtie 2 wrapper, Python
for `bowtie2-build` and `spades.py`, `pigz`, and the shared libraries required
by the copied binaries.

```console
docker build --target nuvs .
```

## Result shape

- **The raw `results` shape is pinned by `formatNuvs`**
  (`packages/data/src/analyses/format.ts`), *not* by
  `packages/contracts/src/nuvs.ts`, which describes the **formatted**
  envelope. The workflow writes each ORF hit's `hit` (an annotation id) and
  never `cluster`, `families` or `names`, which the server merges in from the
  `hmms` table.

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the complete environment-variable table and configuration rules.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/nuvs build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/nuvs start` | Run the bundle |
| `pnpm --filter @virtool/nuvs test` | Run the Vitest suite |
| `pnpm --filter @virtool/nuvs test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/nuvs typecheck` | `tsc --noEmit` |
