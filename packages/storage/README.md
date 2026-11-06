# @virtool/storage

The server-only streaming object-storage interface, with S3, Azure, and
in-memory backends. See [the storage settings](../../docs/storage.md#configuration)
to configure a backend.

| Backend   | Presigned downloads | Direct browser uploads |
| --------- | ------------------- | ---------------------- |
| S3        | Yes                 | No                     |
| Azure     | Yes                 | Yes                    |
| In-memory | No                  | No                     |

The web server turns these capabilities on. See
[its configuration](../../apps/web/README.md#configuration).

## Testing

The `unit` Vitest project needs no network. The `integration` project needs
Docker. It tests the S3 and Azure backends against Garage and Azurite containers
that stay up between runs.

## Commands

Run from the monorepo root.

| Command                                     | Action                   |
| ------------------------------------------- | ------------------------ |
| `pnpm --filter @virtool/storage test`       | Run the Vitest projects. |
| `pnpm --filter @virtool/storage test:watch` | Run tests in watch mode. |
| `pnpm --filter @virtool/storage typecheck`  | Type-check the package.  |
