# `@virtool/service`

Process-lifecycle utilities shared by long-lived Virtool services. It exports
the shutdown controller from `@virtool/service/shutdown`. On shutdown, a
service stops reporting ready, runs its hooks, closes its listener and
database pool, and flushes Sentry within one time budget.

## Commands

Run from the monorepo root.

| Command                                     | Action                   |
| ------------------------------------------- | ------------------------ |
| `pnpm --filter @virtool/service test`       | Run tests.               |
| `pnpm --filter @virtool/service test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/service typecheck`  | Type-check the package.  |
