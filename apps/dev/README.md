# @virtool/dev

Private Linux development daemon, CLI, and management UI for this repository.
It reconciles Git worktrees and Docker Compose environments, owns the shared
local gateway and storage services, and schedules one-shot workflow executors.

Use the repository launcher rather than running this package directly:

```shell
vtd up
vtd ui
```

The launcher installs and starts one foreground systemd user service per Git
repository. Systemd owns crash and source-update restarts; `vtd daemon stop`
stops that repository's unit.

```shell
pnpm --filter @virtool/dev test
pnpm --filter @virtool/dev typecheck
pnpm --filter @virtool/dev build
```

See [the development guide](../../dev/README.md) for the runtime architecture,
data and cleanup contracts, scheduler behavior, and rollout notes.
