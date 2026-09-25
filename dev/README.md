# Development service

`@virtool/dev` is the Linux-only local development coordinator. One daemon runs
per Git repository and manages a distinct Docker Compose environment for each
worktree.

Node 24, pnpm, Docker Engine with Compose, Git, and Worktrunk are prerequisites.
Install the pnpm workspace before the first command. Mise adds `dev/bin` to
`PATH`.

```shell
vtd up
vtd stop
vtd remove
vtd list
vtd ui
vtd daemon stop
```

The first command installs and starts a systemd user service for the
repository. Commands return immediately; the UI at <https://dev.localhost:9443>
shows progress, failures, and logs. The daemon restarts itself when
`apps/dev` changes.

Each environment is served at `https://<environment>.localhost:9443`. Its
hostname and data stay the same when you rename the branch or move the
worktree. Removing a worktree with Worktrunk also removes its environment.

## State

The daemon keeps its state, secrets, and logs in `<git-common-dir>/virtool-dev/`.
Caddy's development CA root is at `<git-common-dir>/virtool-dev/root.crt`; trust
it manually if you need to. The daemon never changes the host trust store.

Use `systemctl --user status virtool-dev-<repository-id>.service` to see the
service state.

## Data safety

Stopping keeps all data. Removing deletes only that environment's database,
blob container, secrets, and Docker resources. Shared Postgres, Azurite, and
Caddy storage is never removed by environment cleanup.

If shared storage disappears after initialization, the daemon shows an error
instead of recreating it. Use the shared reset control in the UI only when you
intend to destroy all local development state.

## Workflows

Workflow images build on demand. The daemon runs queued workflow jobs from all
ready environments, one at a time by default. Set the concurrency in the UI.
Stopped and failed environments receive no new workflow jobs.
