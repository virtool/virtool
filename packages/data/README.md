# @virtool/data

The server-only Postgres data layer: the schema, the database pool, test
fixtures, and the domain queries that Virtool services use.

## Schema ownership

This package owns the Postgres schema. Deploy migrations with the `migrate`
process of [`@virtool/internal`](../../apps/internal/README.md#migrate-database-migrations).

The first migration describes the schema as it was when this package took
ownership. Production is stamped as already migrated. Never run that migration
against an existing database.

You can't roll back to a release from before the Better Auth cutover. A session
minted before a legacy password change must not become valid again.

## Outbound email

Virtool sends transactional email through Resend. The `run` process of
[`@virtool/internal`](../../apps/internal/README.md) delivers it.

Email configuration that is off, unconfigured, or invalid doesn't stop any
service. While sending is off, Virtool discards new messages and still delivers
the messages that are already in the queue.

Virtool retries a failing message until a delivery deadline, then marks it
failed. It removes accepted and failed messages from the queue after a retention
period. When Resend accepts a message, that doesn't prove that the message
reached the mailbox.

## Testing

Tests need Docker. They run against a Postgres container that stays up between
runs. Remove it with `docker rm -f` when you no longer want it.

## Commands

Run from the monorepo root.

| Command                                                 | Action                                |
| ------------------------------------------------------- | ------------------------------------- |
| `pnpm --filter @virtool/data test`                      | Run tests against Postgres.           |
| `pnpm --filter @virtool/data test:watch`                | Run tests in watch mode.              |
| `pnpm --filter @virtool/data typecheck`                 | Type-check the package.               |
| `pnpm --filter @virtool/data db:generate --name <name>` | Generate a migration from the schema. |

Storage-specific commands are documented in
[`@virtool/storage`](../storage/README.md#commands).
