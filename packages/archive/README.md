# `@virtool/archive`

Tar, gzip, and zip utilities for anything in the monorepo that reads or writes
an archive. The package has no database, object storage, or logger dependency.

- Import from `@virtool/archive` or from a subpath: `/tar`, `/zip`,
  `/compression`, or `/errors`.

## Commands

Run from the monorepo root.

| Command                                    | Action                  |
| ------------------------------------------ | ----------------------- |
| `pnpm --filter @virtool/archive test`      | Run tests.              |
| `pnpm --filter @virtool/archive typecheck` | Type-check the package. |
