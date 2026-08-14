# @virtool/nuvs

NuVs finds viruses the reference does **not**
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

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/nuvs build` | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/nuvs start` | Run the bundle |
| `pnpm --filter @virtool/nuvs test` | Run the Vitest suite |
| `pnpm --filter @virtool/nuvs test:watch` | Vitest in watch mode |
| `pnpm --filter @virtool/nuvs typecheck` | `tsc --noEmit` |

