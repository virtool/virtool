# `@virtool/env`

Server-only helper for file-backed environment variables. It depends on
`node:fs`, so keep it out of the browser graph.

`resolveFileBacked` takes a list of keys. For each key, it reads the
`<KEY>_FILE` variable and puts the file contents in `<KEY>`. The file wins over a plain variable of the same name.
An unreadable path throws. An empty file counts as unset.

```ts
import { resolveFileBacked } from "@virtool/env";

const env = resolveFileBacked(["VT_POSTGRES_URL"]);
```

See [Environment configuration](../../docs/env.md) for the naming convention
and the services that use it.

## Commands

Run from the monorepo root.

| Command                                | Action                  |
| -------------------------------------- | ----------------------- |
| `pnpm --filter @virtool/env test`      | Run tests.              |
| `pnpm --filter @virtool/env typecheck` | Type-check the package. |
