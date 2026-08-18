# @virtool/data

The server-only Postgres data layer: the Drizzle schema mirror, database pool,
test fixtures, and domain queries used by Virtool services.

## Testing

Tests run as one Node Vitest project against a Postgres testcontainer. The
project owns the shared container definition in `src/db/test/globalSetup.ts`;
the web server project, `@virtool/jobs-api`, and `@virtool/tasks` import that
setup rather than defining another container. The project has its own CI job
and is excluded from `Packages / Test`. Place tests beside their source as
`*.test.ts`.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/data test` | Run tests against Postgres. |
| `pnpm --filter @virtool/data test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/data typecheck` | Type-check the package. |
