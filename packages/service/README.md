# `@virtool/service`

Process-lifecycle utilities shared by long-lived Virtool services. It currently
exports `createShutdownController` from `@virtool/service/shutdown`; probe
servers and metrics registries remain app-owned.

The controller flips readiness, runs registered hooks in reverse order, closes
the listener and database pool, and flushes Sentry. Each step receives a share
of the shutdown budget unless a hook reserves its own `timeoutMs`. Dependencies
are injected, failures set `process.exitCode`, and an unreferenced backstop
bounds the complete sequence.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/service test` | Run tests. |
| `pnpm --filter @virtool/service test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/service typecheck` | Type-check the package. |
