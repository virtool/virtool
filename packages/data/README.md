# @virtool/data

The server-only Postgres data layer: the Drizzle schema mirror, database pool,
test fixtures, and domain queries used by Virtool services.

## Schema ownership

The Python `virtool` repository owns the Postgres schema and applies its Alembic
migrations. This package mirrors that schema for Drizzle and does not ship
migrations of its own.

When an endpoint needs a schema change:

1. Add and deploy the Alembic migration from the Python repository.
2. Update `src/db/schema/` to match it.
3. Migrate the endpoint to TypeScript.

The TypeScript mirror may temporarily lag the deployed schema, but the Python
application must never lag it while Python remains in production.

### Taking ownership of migrations

Before moving schema ownership to this package, baseline Drizzle against the
production schema. Compare the initial generated migration with
`pg_dump --schema-only`, then stamp production as already migrated instead of
applying that initial migration. In particular, verify constraint names,
default expressions, indexes, and enum value ordering.

Keep `drizzle-orm` and `drizzle-kit` on compatible versions. Check both release
notes when updating either package because their schema-generation internals
change together.

## Outbound requests

Third-party requests use `USER_AGENT` from `@virtool/data/userAgent`, which is
the unversioned product token `virtool`. NCBI throttles or blocks anonymous
traffic, while GitHub rejects requests without a `User-Agent`.

There is deliberately no shared HTTP client. Each call site owns its timeout,
and the shared constant keeps identification consistent without introducing
module-scope client construction. The token has no version because this package
cannot access the app-specific build versions used by `apps/web` and
`apps/tasks`.

## Task queue

`src/tasks/data.ts` owns persistence for the Postgres task queue shared by task
producers and `apps/tasks`. Task names live in `@virtool/contracts`:

- `PeriodicTaskName` is the set scheduled by the task service.
- `OnDemandTaskName` is the set accepted by `createTask()`.
- `TaskName` is the complete set the task service runs.

Create on-demand tasks through `createTask()`. When a domain row points at a
task, create both and attach them in the same transaction so neither can be
published without the other. The row itself is the enqueue signal; the runner
polls Postgres, so producers send no additional notification.

The data layer also owns claiming, lease renewal, fencing, progress, completion,
failure, release, and queue metrics reads. Every mutation that changes a task's
visible state publishes the corresponding `tasks` event. The execution and
shutdown contracts are documented in
[`apps/tasks/README.md`](../../apps/tasks/README.md).

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
