# @virtool/storage

The server-only streaming object-storage interface and its S3, Azure, and
in-memory implementations.

## Testing

The `unit` Vitest project covers behavior testable with `MemoryStorage`. The
`integration` project exercises the S3 and Azure backends against real Garage
and Azurite containers and has its own CI job. Place tests beside their source
as `*.test.ts`.

## Commands

Run from the monorepo root.

| Command | Action |
| --- | --- |
| `pnpm --filter @virtool/storage test` | Run the Vitest projects. |
| `pnpm --filter @virtool/storage test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/storage typecheck` | Type-check the package. |
