# `@virtool/contracts`

The framework-independent types, schemas, and constants shared across Virtool
wire boundaries. Import public contracts from the package root.

Types written by a server and consumed by a client belong here so neither side
depends on the other's implementation modules. Search this package before
declaring a wire shape, import its names directly, and do not re-export them
through an app feature. Keep client-only request state in the app and
data-layer options, values, errors, and row types in `@virtool/data`.

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
