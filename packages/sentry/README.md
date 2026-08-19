# `@virtool/sentry`

Shared Sentry configuration for Virtool services and the browser. The package
defines SDK-independent options and accepts each app's initialized SDK rather
than importing one itself.

- Import server options from `@virtool/sentry`.
- Import browser options from `@virtool/sentry/browser`.
- Import the pino destination stream from `@virtool/sentry/log`.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/sentry test` | Run tests. |
| `pnpm --filter @virtool/sentry typecheck` | Type-check the package. |
