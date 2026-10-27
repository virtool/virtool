# @virtool/dev-tools

Developer commands that act on one local development environment through
`@virtool/data`. This app is for development only. No production image
contains it.

The daemon (`@virtool/dev`) runs these commands in the `dev-tools` Compose
service of an environment:

```shell
docker compose run --rm dev-tools <verb> <resource> [options]
```

The service builds the app from the mounted worktree source, then runs it. It
reads `VT_POSTGRES_URL_FILE` from the environment's configuration directory.
Each command uses the same data-layer functions as the application, so the
resources it makes are valid for the schema of its branch.

## Commands

| Command | Result |
| --- | --- |
| `create administrator --handle=<handle> --email=<email> --password=<password>` | Creates a full administrator if the database has no users. Otherwise, it makes no change. |

Give each value in the `--name=value` form. The `--name value` form rejects a
value that starts with `-`.

`create administrator` first checks for users. If users exist, it makes no
change and does not check the values. If no users exist, it applies the
handle, email, and minimum password length rules of the first-user setup page.
These rules are in `checkAccountCredentials` in `@virtool/contracts`.

## Development

```shell
pnpm --filter @virtool/dev-tools test
pnpm --filter @virtool/dev-tools typecheck
pnpm --filter @virtool/dev-tools build
```

The tests use a Postgres testcontainer.
