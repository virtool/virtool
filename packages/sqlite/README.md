# `@virtool/sqlite`

The reference index SQLite artifact: its schema, the reads that a workflow makes
against an artifact, and the writer that creates one. The server and the
workflows both use this package. See [Indexes](../../docs/references.md) for the
artifact files.

## Commands

Run from the monorepo root.

| Command                                    | Action                   |
| ------------------------------------------ | ------------------------ |
| `pnpm --filter @virtool/sqlite test`       | Run tests.               |
| `pnpm --filter @virtool/sqlite test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/sqlite typecheck`  | Type-check the package.  |
