# @virtool/storage

The server-only streaming object-storage interface and its S3, Azure, and
in-memory implementations.

## Presigned downloads

`StorageBackend.presignDownload` is an optional capability: it mints a
short-lived, read-only URL that serves an object straight from the storage
service, so a caller can redirect a download instead of streaming the bytes
through itself. The `contentDisposition` and `contentType` passed in become the
headers the service sends, because a cross-origin `<a download>` is ignored by
the browser and the filename has to come from the URL.

- **S3** signs a `GetObject` GET with the SDK's presigner.
- **Azure** mints a user-delegation SAS under the account's managed identity —
  the delegation key is an account-level round trip valid up to seven days, so
  it is cached and refreshed before it lapses. With a shared access key
  (Azurite in development) it signs the SAS directly. `downloadUrl` rehosts the
  URL onto a public host such as `files.virtool.ca`; the SAS signs the resource
  path, not the host, so serving it elsewhere still validates.
- **`MemoryStorage`** leaves the method undefined, and a caller falls back to
  streaming.

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
