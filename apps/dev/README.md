# @virtool/dev

Private Linux development daemon, CLI, and management UI for this repository.
It reconciles Git worktrees and Docker Compose environments, owns the shared
local gateway and storage services, and schedules one-shot workflow executors.

Start it with the `vtd` launcher. See [the development guide](../../dev/README.md)
for usage.

```shell
pnpm --filter @virtool/dev test
pnpm --filter @virtool/dev typecheck
pnpm --filter @virtool/dev build
```

The management UI tests run in Chromium. Install it with
`pnpm --filter @virtool/dev exec playwright install chromium`.
