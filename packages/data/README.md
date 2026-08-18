# @virtool/data

The server-only Postgres data layer: the Drizzle schema mirror, database pool,
test fixtures, and domain queries used by Virtool services.

## Outbound requests

Third-party requests use `USER_AGENT` from `@virtool/data/userAgent`, which is
the unversioned product token `virtool`. NCBI throttles or blocks anonymous
traffic, while GitHub rejects requests without a `User-Agent`.

There is deliberately no shared HTTP client. Each call site owns its timeout,
and the shared constant keeps identification consistent without introducing
module-scope client construction. The token has no version because this package
cannot access the app-specific build versions used by `apps/web` and
`apps/tasks`.

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project owns the shared container definition in `src/db/test/globalSetup.ts`;
the web server project, `@virtool/jobs-api`, and `@virtool/tasks` import that
setup rather than defining another container. The project has its own CI job
and is excluded from `Packages / Test`. Place tests beside their source as
`*.test.ts`.

Call `createTestDatabase()` from `@virtool/data/db/test/fixtures` once per test
file and drop it in `afterAll`. It creates an isolated database, applies the
schema derived from the Drizzle mirror, and installs the `client_events`
emitter on its connection. If a test mocks `@virtool/data/events/emit`, mock
both `emit` and `createEmitter` so fixture setup can still install the emitter.

The shared container uses `withReuse()` and deliberately has no teardown, so
local suites reuse it. Remove it with `docker rm -f` when it is no longer
wanted; separate CI jobs still start separate containers.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/data test` | Run tests against Postgres. |
| `pnpm --filter @virtool/data test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/data typecheck` | Type-check the package. |
