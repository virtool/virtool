# Virtool

## Development

The local development environment uses Coasts and Docker Compose. Install the
tools listed in [the development documentation](dev/README.md), then run these
commands from the repository root:

```shell
coast daemon start
coasts up               # create or resume this worktree's Coast
coasts status
coasts stop             # stop the Coast and keep its data
coasts remove           # remove the Coast and its data
```

See [the development documentation](dev/README.md) for the architecture,
worktree isolation, live editing, and lifecycle details.
