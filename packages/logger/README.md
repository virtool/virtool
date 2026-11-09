# `@virtool/logger`

A thin wrapper over [pino](https://getpino.io), shared by the web app and the
internal app. Server code logs through it and never through `console.*`.

- Import `createLogger` from `@virtool/logger`.

## Configuration

| Variable       | Meaning                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `VT_LOG_LEVEL` | The log level. The default is `info` when `NODE_ENV=production`, and `debug` otherwise. |

The logger censors common secret fields, such as session tokens and API keys,
before any destination sees a record. When a Sentry DSN is configured, services
also forward `info` and higher records to Sentry.

## Commands

Run from the monorepo root.

| Command                                   | Action                  |
| ----------------------------------------- | ----------------------- |
| `pnpm --filter @virtool/logger test`      | Run tests.              |
| `pnpm --filter @virtool/logger typecheck` | Type-check the package. |
