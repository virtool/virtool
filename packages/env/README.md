# `@virtool/env`

Server-only helper for file-backed environment variables. It depends on
`node:fs`, so keep it out of the browser graph.

For each listed key, the file named by `<KEY>_FILE` supplies the value of
`<KEY>`. See [Environment configuration](../../docs/env.md) for the naming
convention.

## Commands

Run from the monorepo root.

| Command                                | Action                  |
| -------------------------------------- | ----------------------- |
| `pnpm --filter @virtool/env test`      | Run tests.              |
| `pnpm --filter @virtool/env typecheck` | Type-check the package. |
