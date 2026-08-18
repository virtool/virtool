# `@virtool/contracts`

The framework-independent types, schemas, and constants shared across Virtool
wire boundaries. Import public contracts from the package root.

The `@virtool/contracts/bearer` and `@virtool/contracts/env` subpaths are
server-only because they depend on Node APIs. Keeping them out of the root
barrel prevents native dependencies from entering the browser graph.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/contracts test` | Run tests. |
| `pnpm --filter @virtool/contracts test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/contracts typecheck` | Type-check the package. |
