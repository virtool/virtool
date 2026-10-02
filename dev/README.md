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

## Default administrator

Set a default handle, email, and password on the **Shared** page of the UI.
After migrations, each environment that starts creates a full administrator
with these values if its database has no users. The daemon never changes
existing users.

The daemon keeps the values in its state. The UI and `vtd list` never show the
password. When you save the setting without a password, the daemon keeps the
saved password.

The daemon stores the password as plain text and gives it to each environment
as plain text. Do not use a real or sensitive password.

When you save the setting, the daemon checks the values against the rules of
the first-user setup page and rejects values that are not valid. It checks the
password against the default minimum length. Environments that already have
users skip the check and make no change.

The daemon runs `create administrator` from
[`@virtool/dev-tools`](../apps/dev-tools/README.md). Worktrees on branches that
do not have the `dev-tools` Compose service skip this step.

To create an environment without the default administrator, open the menu
next to **Create** on the worktree and clear **Create default administrator**.
The daemon keeps this choice with the environment and skips the step on each
later start. You cannot change the choice after you create the environment.
To change it, delete the environment data and create the environment again.
The environment detail page shows the choice. **Create**, **Start**, and
`vtd up` use the default, which creates the administrator.

## Workflows

Workflow images build on demand. The daemon runs queued workflow jobs from all
ready environments, one at a time by default. Set the concurrency in the UI.
Stopped and failed environments receive no new workflow jobs.
